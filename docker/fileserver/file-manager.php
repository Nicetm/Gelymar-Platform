<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gelymar File Manager</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="config.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f3f4f6;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: #111827;
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 1.4rem;
            margin: 0;
        }
        
        .breadcrumb {
            background: #f8f9fa;
            padding: 1rem 2rem;
            border-bottom: 1px solid #e9ecef;
        }
        
        .breadcrumb a {
            color: #667eea;
            text-decoration: none;
            margin-right: 0.5rem;
        }
        
        .breadcrumb a:hover {
            text-decoration: underline;
        }
        
        .toolbar {
            background: #f8f9fa;
            padding: 1rem 2rem;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 0.3rem 0.6rem;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            font-size: 0.75rem;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: #1d4ed8;
            color: white;
        }
        
        .btn-primary:hover {
            background: #1e40af;
        }
        
        .btn-success {
            background: #059669;
            color: white;
        }
        
        .btn-success:hover {
            background: #047857;
        }
        
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        
        .btn-danger:hover {
            background: #c82333;
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #5a6268;
        }
        
        .file-list {
            padding: 1rem 2rem;
        }
        
        .file-item {
            display: flex;
            align-items: center;
            padding: 0.4rem 1rem;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 0.3rem;
            transition: all 0.3s;
            background: white;
        }
        
        .file-item:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
        }
        
        .file-icon {
            margin-right: 0.75rem;
            width: 30px;
            text-align: center;
        }
        
        .file-info {
            flex: 1;
        }
        
        .file-name {
            color: #333;
            margin-bottom: 0.25rem;
        }
        
        .file-meta {
            font-size: 0.8rem;
            color: #666;
        }
        
        .file-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }
        
        .modal-content {
            background-color: white;
            margin: 10% auto;
            padding: 2rem;
            border-radius: 10px;
            width: 90%;
            max-width: 500px;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .close {
            font-size: 1.5rem;
            cursor: pointer;
            color: #666;
        }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }
        
        .form-group input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        
        .alert {
            padding: 1rem;
            border-radius: 5px;
            margin-bottom: 1rem;
        }
        
        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .alert-danger {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .empty-state {
            text-align: center;
            padding: 3rem;
            color: #666;
        }
        
        .empty-state i {
            font-size: 3rem;
            margin-bottom: 1rem;
            color: #ddd;
        }
    </style>
    <script>
        // Verificar autenticación se hará en DOMContentLoaded
        let currentPath = '';
        let files = [];
        
        // Función para formatear tamaño de archivo
        function formatFileSize(bytes) {
            if (bytes >= 1073741824) {
                return (bytes / 1073741824).toFixed(2) + ' GB';
            } else if (bytes >= 1048576) {
                return (bytes / 1048576).toFixed(2) + ' MB';
            } else if (bytes >= 1024) {
                return (bytes / 1024).toFixed(2) + ' KB';
            } else {
                return bytes + ' bytes';
            }
        }
        
        // Función para obtener icono según tipo de archivo
        function getFileIcon(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            const icons = {
                'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📄',
                'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
                'zip': '📦', 'rar': '📦', '7z': '📦',
                'xls': '📊', 'xlsx': '📊', 'csv': '📊',
                'mp4': '🎥', 'avi': '🎥', 'mov': '🎥',
                'mp3': '🎵', 'wav': '🎵', 'flac': '🎵'
            };
            return icons[ext] || '📄';
        }
        
        // Cargar archivos del directorio actual
        function buildDownloadUrl(filePath) {
            const token = localStorage.getItem('user_token');
            const backendUrl = window.APP_CONFIG?.BACKEND_BASE_URL || 'http://localhost:3000';
            const encodedPath = encodeURIComponent(filePath || '');
            const encodedToken = token ? `&token=${encodeURIComponent(token)}` : '';
            return `${backendUrl}/api/fileserver/download?path=${encodedPath}${encodedToken}`;
        }

        async function loadFiles() {
            try {
                const token = localStorage.getItem('user_token');
                
                if (!token) {
                    console.error('No hay token, redirigiendo al login');
                    window.location.href = 'login.html';
                    return;
                }
                
                // Saltar verificación de token, se validará en la petición real
                
                // Usar configuración desde variables de entorno
                const backendUrl = window.APP_CONFIG?.BACKEND_BASE_URL || 'http://localhost:3000';
                const response = await fetch(`${backendUrl}/api/fileserver/files?path=${encodeURIComponent(currentPath)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    files = data.files || [];
                    renderFiles();
                    updateBreadcrumb();
                } else if (response.status === 401) {
                    console.error('❌ Token inválido, redirigiendo al login');
                    localStorage.clear();
                    window.location.href = 'login.html';
                    return;
                } else {
                    console.error('Error al cargar archivos:', response.status);
                }
            } catch (error) {
                console.error('Error de conexión:', error);
            }
        }
        
        // Renderizar archivos en la interfaz
        function renderFiles() {
            const fileList = document.getElementById('fileList');
            
            // Ocultar archivos del sistema
            const hiddenFiles = new Set(['.htaccess', '.htpasswd', 'index.html', 'index.php', 'login.html', 'file-manager.php', 'style.css', 'config.js']);
            const visibleFiles = files.filter(f => !hiddenFiles.has(f.name));
            
            if (visibleFiles.length === 0) {
                fileList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <h3>Directorio vacío</h3>
                        <p>No hay archivos ni carpetas en este directorio.</p>
                    </div>
                `;
                return;
            }
            
            fileList.innerHTML = visibleFiles.map(file => `
                <div class="file-item">
                    <div class="file-icon">
                        ${file.isDirectory ? '📁' : getFileIcon(file.name)}
                    </div>
                    <div class="file-info">
                        <div class="file-name">
                            ${file.isDirectory ? 
                                `<a href="#" onclick="navigateTo('${file.path}')" style="color: inherit; text-decoration: none;">${file.name}</a>` : 
                                file.name
                            }
                        </div>
                        <div class="file-meta">
                            ${file.isDirectory ? 
                                '' : 
                                `${formatFileSize(file.size)} • ${new Date(file.modified).toLocaleString()}`
                            }
                        </div>
                    </div>
                    <div class="file-actions">
                        ${!file.isDirectory ? 
                            `<a href="${buildDownloadUrl(file.path)}" class="btn btn-primary" target="_blank" rel="noopener">
                                <i class="fas fa-download"></i>
                            </a>` : ''
                        }
                        <button class="btn btn-danger" onclick="deleteItem('${file.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        // Actualizar breadcrumb
        function updateBreadcrumb() {
            const breadcrumb = document.getElementById('breadcrumb');
            const pathParts = currentPath.split('/').filter(part => part);
            
            let breadcrumbHTML = '<a href="#" onclick="navigateTo(\'\')">📁 Uploads</a>';
            let currentPathAccumulator = '';
            
            pathParts.forEach((part, index) => {
                currentPathAccumulator += (currentPathAccumulator ? '/' : '') + part;
                breadcrumbHTML += ` / <a href="#" onclick="navigateTo('${currentPathAccumulator}')">${part}</a>`;
            });
            
            breadcrumb.innerHTML = breadcrumbHTML;
        }
        
        // Navegar a un directorio
        function navigateTo(path) {
            currentPath = path;
            loadFiles();
        }
        
        // Subir archivo
        async function uploadFile() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Por favor selecciona un archivo');
                return;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', currentPath);
            
            try {
                const token = localStorage.getItem('user_token');
                // Usar configuración desde variables de entorno
                const backendUrl = window.APP_CONFIG?.BACKEND_BASE_URL || 'http://localhost:3000';
                const response = await fetch(`${backendUrl}/api/fileserver/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                if (response.ok) {
                    alert('Archivo subido correctamente');
                    loadFiles();
                    closeModal('uploadModal');
                } else {
                    alert('Error al subir el archivo');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error de conexión');
            }
        }
        
        // Crear directorio
        async function createDirectory() {
            const dirName = document.getElementById('dirName').value;
            
            if (!dirName) {
                alert('Por favor ingresa un nombre para la carpeta');
                return;
            }
            
            try {
                const token = localStorage.getItem('user_token');
                // Usar configuración desde variables de entorno
                const backendUrl = window.APP_CONFIG?.BACKEND_BASE_URL || 'http://localhost:3000';
                const response = await fetch(`${backendUrl}/api/fileserver/mkdir`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        path: currentPath,
                        name: dirName
                    })
                });
                
                if (response.ok) {
                    alert('Directorio creado correctamente');
                    loadFiles();
                    closeModal('mkdirModal');
                } else {
                    alert('Error al crear el directorio');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error de conexión');
            }
        }
        
        // Eliminar archivo/directorio
        async function deleteItem(fileName) {
            if (!confirm(`¿Estás seguro de que quieres eliminar "${fileName}"?`)) {
                return;
            }
            
            try {
                const token = localStorage.getItem('user_token');
                // Usar configuración desde variables de entorno
                const backendUrl = window.APP_CONFIG?.BACKEND_BASE_URL || 'http://localhost:3000';
                const response = await fetch(`${backendUrl}/api/fileserver/delete`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        path: currentPath,
                        name: fileName
                    })
                });
                
                if (response.ok) {
                    alert('Archivo eliminado correctamente');
                    loadFiles();
                } else {
                    alert('Error al eliminar el archivo');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error de conexión');
            }
        }
        
        // Funciones de modal
        function openUploadModal() {
            document.getElementById('uploadModal').style.display = 'block';
        }
        
        function openMkdirModal() {
            document.getElementById('mkdirModal').style.display = 'block';
        }
        
        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
        
        // Cerrar modal al hacer clic fuera
        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        }
        
        // Función de logout
        function logout() {
            localStorage.removeItem('user_token');
            localStorage.removeItem('user_data');
            localStorage.removeItem('authenticated');
            window.location.href = 'login.html';
        }
        
        // Cargar archivos al iniciar
        document.addEventListener('DOMContentLoaded', function() {
            // Verificar autenticación una sola vez
            const token = localStorage.getItem('user_token');
            if (!token) {
                window.location.href = 'login.html';
                return;
            }
            loadFiles();
        });
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-folder-open"></i> Gelymar File Manager</h1>
            <div>
                <a href="login.html" class="btn btn-secondary">
                    <i class="fas fa-home"></i> Inicio
                </a>
                <button class="btn btn-secondary" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Salir
                </button>
            </div>
        </div>
        
        <div class="breadcrumb" id="breadcrumb">
            <a href="#" onclick="navigateTo('')">📁 Uploads</a>
        </div>
        
        <div class="toolbar">
            <button class="btn btn-primary" onclick="openUploadModal()">
                <i class="fas fa-upload"></i> Subir Archivo
            </button>
            <button class="btn btn-success" onclick="openMkdirModal()">
                <i class="fas fa-folder-plus"></i> Nueva Carpeta
            </button>
            <button class="btn btn-secondary" onclick="loadFiles()">
                <i class="fas fa-sync-alt"></i> Actualizar
            </button>
        </div>
        
        <div class="file-list" id="fileList">
            <!-- Los archivos se cargarán aquí dinámicamente -->
        </div>
    </div>
    
    <!-- Modal para subir archivo -->
    <div id="uploadModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-upload"></i> Subir Archivo</h3>
                <span class="close" onclick="closeModal('uploadModal')">&times;</span>
            </div>
            <div class="form-group">
                <label for="fileInput">Seleccionar archivo:</label>
                <input type="file" id="fileInput" required>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button type="button" class="btn btn-primary" onclick="uploadFile()">Subir</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal('uploadModal')">Cancelar</button>
            </div>
        </div>
    </div>
    
    <!-- Modal para crear directorio -->
    <div id="mkdirModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-folder-plus"></i> Nueva Carpeta</h3>
                <span class="close" onclick="closeModal('mkdirModal')">&times;</span>
            </div>
            <div class="form-group">
                <label for="dirName">Nombre de la carpeta:</label>
                <input type="text" id="dirName" required>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button type="button" class="btn btn-success" onclick="createDirectory()">Crear</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal('mkdirModal')">Cancelar</button>
            </div>
        </div>
    </div>
</body>
</html>
