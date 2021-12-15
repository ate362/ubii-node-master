FROM node:14-bullseye

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN apt-get update -qq && \
apt-get install -y -qq libzmq5-dev

RUN npm install

# Bundle app source
COPY . /usr/src/app

EXPOSE 8101 8102 8103 8104
CMD ["npm", "start"]