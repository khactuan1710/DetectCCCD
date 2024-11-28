# CCCD Text Recognition API

1. Front Image Detect API:

   ```bash
   curl --location 'http://localhost:8080/api/detect/front' \
   --header 'Content-Type: application/x-www-form-urlencoded' \
   --data-urlencode 'imageBase64=data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...'
