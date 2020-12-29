FROM node:14

WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

EXPOSE 18545
EXPOSE 9090

CMD [ "yarn", "run", "start"]
