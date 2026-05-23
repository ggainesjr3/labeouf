FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip

WORKDIR /app

RUN pip3 install nltk --break-system-packages
RUN python3 -m nltk.downloader -d /app/nltk_data vader_lexicon

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --prefer-offline

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/main.js"]
