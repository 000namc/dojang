FROM alpine:3.19

RUN apk add --no-cache git bash

COPY setup.sh /setup.sh
RUN chmod +x /setup.sh && /setup.sh

WORKDIR /repos
CMD ["tail", "-f", "/dev/null"]
