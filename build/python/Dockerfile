FROM python:3.13-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends bash && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    numpy==2.2.4 \
    pandas==2.2.3 \
    scikit-learn==1.6.1 \
    matplotlib==3.10.1

RUN mkdir -p /workspace
WORKDIR /workspace

# 선형회귀 연습용 샘플 데이터
COPY gen_data.py /tmp/gen_data.py
RUN python3 /tmp/gen_data.py && rm /tmp/gen_data.py

CMD ["tail", "-f", "/dev/null"]
