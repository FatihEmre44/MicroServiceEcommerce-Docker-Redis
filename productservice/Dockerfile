# 1. Base Image
FROM node:18-alpine

# 2. Working Directory
WORKDIR /app

# 3. Dependencies
COPY package*.json ./

# 4. Install
RUN npm install

# 5. Copy Source
COPY . .

# 6. Expose Port
EXPOSE 3002

# 7. Start Command
CMD ["node", "index.js"]
