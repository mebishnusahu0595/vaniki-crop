# Vaniki Crop Backup Package

This folder contains **ONLY** the backup assets for **Vaniki Crop** (`vaniki-crop` service) to migrate to the new server.

## Directory Structure

```
vaniki_backup/
├── .env                       # Vaniki Crop environment configuration
├── uploads/                   # Media uploads (banners, categories, products, promotions, users)
├── mongodb_backup/            # MongoDB Backup for 'vaniki-crop' database
│   ├── dump/                  # Standard BSON dump (use mongorestore)
│   │   └── vaniki-crop/
│   └── json_export/           # JSON exports for all 12 collections
├── nginx/                     # Vaniki Crop Nginx server block configuration
├── letsencrypt/               # Vaniki Crop SSL certificates (vanikicrop.com & vanikicropscience.com)
└── README.md                  # Instructions
```

## Restore Instructions for New Server

### 1. Restore MongoDB Database
```bash
# Restore 'vaniki-crop' database
mongorestore --db vaniki-crop ./mongodb_backup/dump/vaniki-crop
```

### 2. Restore Uploads Directory
```bash
cp -r ./uploads /var/www/vaniki-crop/
```

### 3. Environment File
```bash
cp .env /var/www/vaniki-crop/.env
```
