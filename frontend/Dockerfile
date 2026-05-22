FROM node:20-alpine

WORKDIR /app

# Install package descriptors
COPY package.json ./

# Install npm packages
RUN npm install

# Copy source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
