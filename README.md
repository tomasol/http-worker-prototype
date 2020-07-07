# http-worker-prototype

## Building docker images
```
docker-compose build
```

## Starting conductor
Assuming there is a compose file:
```
docker-compose -p http-worker-prototype -f docker-compose.conductor.frinx.yaml up -d
```

## Setting up Vault
Vault must be unsealed and contain some secrets so that the integration test can verify the use case.
Vault will store the key value database in `vault/db`.

1. Start Vault
```sh
docker-compose up -d vault
```
Logs can be printed out using `docker-compose logs -f vault`

2. Init & Unseal
Following steps require `vault` (client) to be available,
```sh
export VAULT_ADDR=http://localhost:8200
vault status
```
however one can use the `vault` container provides:
`docker-compose exec -e VAULT_ADDR=http://localhost:8200 vault /bin/vault status`

a. Initialize vault
```sh
vault operator init -key-shares=1 -key-threshold=1
```
b. Find "Initial Root Token"
```sh
export VAULT_TOKEN=s.fVUoDPeyDjBJbZ2GXl9RFZC7
```
c. Find "Unseal Key 1" and paste it into next command
```sh
vault operator unseal G8rOm5viafSJPoA+zV5zZN0LV5aC4moYSEbexVqNDyQ=
```

3. Enable secrets store
```sh
vault secrets enable -path=secret kv
```
Put some testing secrets to KV store
```sh
vault kv put secret/key1 f1=1 f2=2
vault kv put secret/key2 f1=10 f2=20
```

Setting up Vault is one-time operation, however Vault must be unsealed
every time the container starts. To start from scatch delete `vault_db` volume.

## Starting worker and poller
Start rest of the docker-compose services
```sh
docker-compose up -d
```

## Testing
```sh
node conductor-poller/httpworker-sample-workflow.js
```
