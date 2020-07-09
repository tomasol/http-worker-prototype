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
in memory KV store. Unfortunately nodeJs Vault client does not implement v2 of
key value store API, tracked [here](https://github.com/kr1sp1n/node-vault/issues/82).

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


## Note about reconnect
Current behavior is that failure to comunicate with Conductor results in
shutdown of the process. Orchestrator must restart the process.
