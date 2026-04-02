FROM alpine:3.19

RUN apk add --no-cache bash coreutils grep sed gawk findutils curl wget jq tar gzip

# Create practice directory with sample files
RUN mkdir -p /workspace && cd /workspace && \
    # Basic files
    echo "hello world" > hello.txt && \
    echo "this is a temporary file" > temp.txt && \
    echo "some notes here" > notes.txt && \
    # CSV data
    echo -e "name,age,city\nAlice,30,Seoul\nBob,25,Busan\nCharlie,35,Seoul\nDave,28,Daegu\nEve,32,Seoul" > data.csv && \
    # Realistic server log
    echo -e "2024-01-15 09:00:00 INFO: server started\n\
2024-01-15 09:01:23 INFO: user login - alice\n\
2024-01-15 09:02:45 WARN: slow query detected (3.2s)\n\
2024-01-15 09:05:10 ERROR: disk full - /var/log\n\
2024-01-15 09:06:00 INFO: cleanup job started\n\
2024-01-15 09:07:30 INFO: cleanup completed - freed 2.1GB\n\
2024-01-15 09:10:00 WARN: high memory usage (85%)\n\
2024-01-15 09:12:00 ERROR: timeout - api request exceeded 30s\n\
2024-01-15 09:13:00 INFO: user login - bob\n\
2024-01-15 09:15:00 INFO: backup completed\n\
2024-01-15 09:20:00 ERROR: connection refused - db timeout" > server.log && \
    # Project directory structure
    mkdir -p project/src project/docs project/tests && \
    echo '{"name":"dojang","version":"1.0"}' > project/config.json && \
    echo "print('hello')" > project/src/main.py && \
    echo "# README" > project/docs/README.md && \
    echo "test1" > project/tests/test1.txt && \
    echo "test2" > project/tests/test2.txt && \
    # Trash directory (for deletion exercise)
    mkdir -p trash && \
    echo "delete me" > trash/old1.txt && \
    echo "delete me too" > trash/old2.txt && \
    # Hidden file (for ls -a exercise)
    echo "secret config" > .hidden_config && \
    # JSON array file
    echo '[{"name":"Alice","age":30,"role":"admin"},{"name":"Bob","age":25,"role":"user"},{"name":"Charlie","age":35,"role":"user"}]' > users.json

WORKDIR /workspace
CMD ["tail", "-f", "/dev/null"]
