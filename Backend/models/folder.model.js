class Folder {
    constructor({ id, customer_id, name, path, created_at }) {
      this.id = id;
      this.customer_id = customer_id;
      this.name = name;
      this.path = path;
      this.created_at = created_at;
    }
  }
  
  module.exports = Folder;
  