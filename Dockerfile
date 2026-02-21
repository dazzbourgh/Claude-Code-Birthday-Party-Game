FROM nginx:alpine

# Copy the static web application files to the default Nginx html directory
COPY . /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
