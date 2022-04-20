FROM node:16-alpine

WORKDIR /program
ADD package.json .
ADD yarn.lock .
RUN corepack enable && apk add --no-cache git
RUN yarn install --frozen-lockfile
ADD . .
RUN yarn compile
EXPOSE 8545/tcp
ENTRYPOINT yarn deploy:localhost & yarn serve