.PHONY: build
build:
	docker-compose build

.PHONY: run
run:
	docker-compose run --rm kpi-generator $(name)

.PHONY: sh
sh:
	docker-compose run --rm --entrypoint sh kpi-generator
