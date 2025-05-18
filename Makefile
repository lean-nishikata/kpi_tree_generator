.PHONY: build
build:
	docker-compose build

.PHONY: run
run:
	docker-compose run --rm kpi-generator $(name)

.PHONY: sh
sh:
	docker-compose run --rm --entrypoint sh kpi-generator

.PHONY: historical-report
historical-report:
	docker-compose run --rm --entrypoint "./generate_historical_report.sh" kpi-generator $(date)

.PHONY: historical-report-py
historical-report-py:
	docker-compose run --rm --entrypoint "/app/venv/bin/python ./generate_historical_report.py" kpi-generator $(date)

.PHONY: historical-report-py-docker
historical-report-py-docker:
	docker-compose run --rm --entrypoint "/app/venv/bin/python ./generate_historical_report_docker.py" kpi-generator $(date)
