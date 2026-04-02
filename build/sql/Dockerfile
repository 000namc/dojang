FROM mysql:8.0

ENV MYSQL_ROOT_PASSWORD=dojang
ENV MYSQL_DATABASE=practice

COPY init.sql /docker-entrypoint-initdb.d/

EXPOSE 3306
