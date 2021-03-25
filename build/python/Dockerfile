FROM python:3.9.0a3-alpine3.10
WORKDIR /app/cron/
COPY egov-api-cron-job/requirements.txt .
RUN pip3 install -r requirements.txt
COPY egov-api-cron-job/cronJobAPIConfig.py cronJobAPIConfig.py
