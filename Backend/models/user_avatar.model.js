class UserAvatar {
  constructor({
    id = null,
    user_id,
    uuid = null,
    file_path,
    mime_type,
    file_size,
    is_active = 1,
    created_at = null,
    updated_at = null,
    active_user_id = null
  }) {
    this.id = id;
    this.user_id = user_id;
    this.uuid = uuid;
    this.file_path = file_path;
    this.mime_type = mime_type;
    this.file_size = file_size;
    this.is_active = is_active;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.active_user_id = active_user_id;
  }
}

module.exports = UserAvatar; 