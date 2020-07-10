# http-worker-prototype

## Building docker images
```sh
docker-compose build
```

## Starting conductor
Assuming there is a compose file we can use the same prefix `http-worker-prototype`
to put all containers in the same network:
```
docker-compose -p http-worker-prototype -f docker-compose.conductor.frinx.yaml up -d
```

## Setting up Vault

1. Start Vault
```sh
docker-compose up -d vault
```
Logs can be printed out using `docker-compose logs -f vault`

2. Switch back to kv v1
Since we are running dev version of vault, it automatically enables v2 of the
in memory KV store. See notes below on using kv v2.

Following steps require `vault` (client) to be available,
```sh
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=myroot
vault status
```
however one can use the `vault` container provides:
```sh
docker-compose exec -e VAULT_TOKEN=myroot \
 -e VAULT_ADDR=http://localhost:8200 vault /bin/vault status
```

Third option is to use [Web UI](http://127.0.0.1:8200/ui/), more info
in the [docs](https://learn.hashicorp.com/vault/secrets-management/sm-versioned-kv).

We need to switch `secrets/` store back to v1.
```sh
vault secrets disable secret/
vault secrets enable --version=1 -path=secret kv
```

## Starting worker and poller
Start rest of the docker-compose services
```sh
docker-compose up -d
```

## Testing
From docker host or `poller` container, run
```sh
VAULT_TOKEN=myroot node conductor-poller/httpworker-sample-workflow.js
```
Last line should read `All OK`.

The test puts following data to Vault:
```sh
vault kv put secret/key1 f1=1 f2=2
vault kv put secret/key2 f1=10 f2=20
```
Then it executes a workflow with http task that POSTs some data
with secret variables to httpbin.org and then checks response.

## Note about reconnect
Current behavior is that failure to comunicate with Conductor results in
shutdown of the process. Orchestrator must restart the process.

## Note about kv store v2
It is possible to use the `node-vault` library to read the secrets
from v2 keystore by prepending `data/` to the path. Poller can insert this prefix
automatically to each Vault request. Configuration can be set via environemt variable:
```sh
export VAULT_PATH_PREFIX='data/'
```

or via `config.json` with path `vault.pathPrefix`.

# Vault Agent
Vault Agent is a 'sidecar' process which does auth and token renewal & rotation. This is not handled in poller app.
Vault agent acts as a proxy to Vault. There is no need to send `VAULT_TOKEN`, however if present, the agent will
forward it instead of the locally maintained one.

### Using Vault Agent with JWT auth
For simplicity's sake we are enabling JWT auth in Vault. This demonstrates using the login API and token handling
by Vault Agent.

Enable jwt authentication at path `/jwt`:
```sh
vault auth enable jwt
```

Create named role `dev-role`:

```sh
vault write auth/jwt/role/dev-role \
    role_type="jwt" \
    bound_audiences="myaud" \
    user_claim="sub" \
    policies="default" \
    ttl=10m
```

See `vault/agent.hcl` for configuration of the role.

Note that those settings are for development only and should not be used in production!
We are using `default` policy here. Add following to the policy to allow reading all secrets:
```sh
echo '
# Allow reading all secrets - FOR TESTING ONLY
path "secret/*" {
    capabilities = ["read"]
}

' > default.policy
vault policy read default >> default.policy
vault policy write default default.policy
rm default.policy
```

Generate jwt token using [jwt.io](https://jwt.io) with method RS256,
payload:
```json
{
  "sub": "1234567890",
  "aud": "myaud",
  "iat": 1516239022,
  "exp": 1716239022
}
```
Put the result in the `JWT` variable.

To check that everything is working, login to Vault:
```sh
vault write auth/jwt/login role=dev-role jwt=$JWT
```
Sample result:
```
Key                  Value
---                  -----
token                s.GneIghyM9SIOeqCnccPZDHRZ
token_accessor       xi4qD2VLA1pQKPjLhK6cFXJD
token_duration       24h
token_renewable      true
token_policies       ["default"]
identity_policies    []
policies             ["default"]
token_meta_role      dev-role
```

If the command succeds, run Vault Agent:

```sh
# this file will be deleted by Vault Agent immediately
echo $JWT > vault/jwt.txt
vault agent -config vault/agent.hcl
```
Check that you can get the secrets from agent without any token:
```sh
VAULT_ADDR=http://localhost:8201 vault kv get secret/key1
```

### Starting poller connected to the Vault Agent
To start poller locally, run
```sh
VAULT_ADDR=http://localhost:8201 node conductor-poller/start-conductor-poller.js
```
Run the test mentioned above, it should succeed when Vault Agent is up.

### More info
* [Getting started - Auth using HTTP API](https://learn.hashicorp.com/vault/getting-started/apis)
* [Vault Agent](https://www.vaultproject.io/docs/agent)
* [Generating RSA keypair](https://github.com/hashicorp/vault/issues/5106#issuecomment-415897824)
* [Vault Agent auto-auth using JWT](https://www.vaultproject.io/docs/agent/autoauth/methods/jwt)
* [Vault JWT auth](https://www.vaultproject.io/docs/auth/jwt)
* [Vault JWT API](https://www.vaultproject.io/api/auth/jwt)
* [Web UI for JWT configuration](http://localhost:8200/ui/vault/access/jwt/configuration)
