FROM node:18-alpine AS build
WORKDIR /usr/src/app
COPY . .
RUN npm install
RUN npm run build

FROM node:18-alpine
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./
COPY package* ./
RUN npm install --omit=dev
CMD [ "app.js" ]
