.PHONY: build
build:
	docker-compose build

.PHONY: run
run:
	docker-compose run --rm kpi-generator $(name)

.PHONY: sh
sh:
	docker-compose run --rm --entrypoint sh kpi-generator

.PHONY: debug
debug:
	@echo "Checking service account key..."
	@if [ -f "keys/service-account-key.json" ]; then \
		echo "Key file exists"; \
		ls -la keys/; \
	else \
		echo "Key file NOT found!"; \
	fi
	@echo "Checking environment..."
	docker-compose run --rm --entrypoint sh kpi-generator -c "env | grep GOOGLE && ls -la /app/keys && cat /app/keys/service-account-key.json | head -5 || echo '認証ファイルの内容が読めません'"