FROM node:18-alpine AS development

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Expose port
EXPOSE 3001

CMD ["npm", "run", "dev"]
