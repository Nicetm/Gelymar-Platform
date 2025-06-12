// src/models/File.js
class File {
    constructor(row) {
      this.id = row.id;
      this.customer_id = row.customer_id;
      this.folder_id = row.folder_id;
      this.name = row.name;
      this.format = row.format;
      this.path = row.path;
      this.created_at = row.created_at;
      this.updated_at = row.updated_at;
      this.eta = row.eta;
      this.etd = row.etd;
      this.was_sent = row.was_sent;
      this.status_id = row.status_id;
      this.document_type = row.document_type;
      this.file_type = row.file_type;
      this.status_name = row.status_name;
    }
  }
  
  module.exports = File;