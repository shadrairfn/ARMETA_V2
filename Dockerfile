# Gunakan Node image yang ringan
FROM node:20-alpine

# Set working directory di dalam container
WORKDIR /usr/src/app

# Copy package.json dan package-lock.json (agar caching build lebih efisien)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy seluruh source code ke dalam container
COPY . .

# Expose port aplikasi
EXPOSE 3000

# Jalankan server dengan nodemon (dev mode)
CMD ["npm", "start"]
