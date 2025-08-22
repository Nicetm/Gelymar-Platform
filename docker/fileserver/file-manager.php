<?php
session_start();

// Configuración
$uploadDir = '/var/www/html/uploads';
$currentPath = isset($_GET['path']) ? $_GET['path'] : $uploadDir;
$currentPath = realpath($currentPath);

// Validar que esté dentro del directorio permitido
if (strpos($currentPath, $uploadDir) !== 0) {
    $currentPath = $uploadDir;
}

// Función para formatear tamaño de archivo
function formatFileSize($bytes) {
    if ($bytes >= 1073741824) {
        return number_format($bytes / 1073741824, 2) . ' GB';
    } elseif ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 2) . ' MB';
    } elseif ($bytes >= 1024) {
        return number_format($bytes / 1024, 2) . ' KB';
    } else {
        return $bytes . ' bytes';
    }
}

// Función para obtener icono según tipo de archivo
function getFileIcon($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $icons = [
        'pdf' => '📄', 'doc' => '📝', 'docx' => '📝', 'txt' => '📄',
        'jpg' => '🖼️', 'jpeg' => '🖼️', 'png' => '🖼️', 'gif' => '🖼️',
        'zip' => '📦', 'rar' => '📦', '7z' => '📦',
        'xls' => '📊', 'xlsx' => '📊', 'csv' => '📊',
        'mp4' => '🎥', 'avi' => '🎥', 'mov' => '🎥',
        'mp3' => '🎵', 'wav' => '🎵', 'flac' => '🎵'
    ];
    return isset($icons[$ext]) ? $icons[$ext] : '📄';
}

// Procesar acciones
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        switch ($_POST['action']) {
            case 'delete':
                $fileToDelete = $_POST['file'];
                $fullPath = $currentPath . '/' . basename($fileToDelete);
                if (file_exists($fullPath) && strpos(realpath($fullPath), $uploadDir) === 0) {
                    if (is_dir($fullPath)) {
                        rmdir($fullPath);
                    } else {
                        unlink($fullPath);
                    }
                    $_SESSION['message'] = 'Archivo eliminado correctamente';
                }
                break;
                
            case 'upload':
                if (isset($_FILES['file'])) {
                    $uploadFile = $currentPath . '/' . basename($_FILES['file']['name']);
                    if (move_uploaded_file($_FILES['file']['tmp_name'], $uploadFile)) {
                        $_SESSION['message'] = 'Archivo subido correctamente';
                    } else {
                        $_SESSION['error'] = 'Error al subir el archivo';
                    }
                }
                break;
                
            case 'mkdir':
                $newDir = $_POST['dirname'];
                $newDirPath = $currentPath . '/' . basename($newDir);
                if (!file_exists($newDirPath)) {
                    mkdir($newDirPath, 0755, true);
                    $_SESSION['message'] = 'Directorio creado correctamente';
                } else {
                    $_SESSION['error'] = 'El directorio ya existe';
                }
                break;
        }
        header('Location: ' . $_SERVER['REQUEST_URI']);
        exit;
    }
}

// Obtener contenido del directorio
$items = [];
if (is_dir($currentPath)) {
    $files = scandir($currentPath);
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..') {
            $fullPath = $currentPath . '/' . $file;
            $items[] = [
                'name' => $file,
                'path' => $fullPath,
                'is_dir' => is_dir($fullPath),
                'size' => is_file($fullPath) ? filesize($fullPath) : 0,
                'modified' => filemtime($fullPath),
                'icon' => is_dir($fullPath) ? '📁' : getFileIcon($file)
            ];
        }
    }
}

// Ordenar: directorios primero, luego archivos
usort($items, function($a, $b) {
    if ($a['is_dir'] && !$b['is_dir']) return -1;
    if (!$a['is_dir'] && $b['is_dir']) return 1;
    return strcasecmp($a['name'], $b['name']);
});
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gelymar File Manager</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 1.8rem;
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
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a6fd8;
        }
        
        .btn-success {
            background: #28a745;
            color: white;
        }
        
        .btn-success:hover {
            background: #218838;
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
            padding: 2rem;
        }
        
        .file-item {
            display: flex;
            align-items: center;
            padding: 1rem;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            transition: all 0.3s;
            background: white;
        }
        
        .file-item:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
        }
        
        .file-icon {
            font-size: 1.5rem;
            margin-right: 1rem;
            width: 40px;
            text-align: center;
        }
        
        .file-info {
            flex: 1;
        }
        
        .file-name {
            font-weight: 600;
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
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-folder-open"></i> Gelymar File Manager</h1>
            <div>
                <a href="/" class="btn btn-secondary">
                    <i class="fas fa-home"></i> Inicio
                </a>
            </div>
        </div>
        
        <div class="breadcrumb">
            <a href="?path=<?= urlencode($uploadDir) ?>">📁 Uploads</a>
            <?php
            $pathParts = explode('/', str_replace($uploadDir, '', $currentPath));
            $currentBreadcrumb = $uploadDir;
            foreach ($pathParts as $part) {
                if ($part) {
                    $currentBreadcrumb .= '/' . $part;
                    echo ' / <a href="?path=' . urlencode($currentBreadcrumb) . '">' . htmlspecialchars($part) . '</a>';
                }
            }
            ?>
        </div>
        
        <?php if (isset($_SESSION['message'])): ?>
            <div class="alert alert-success">
                <?= htmlspecialchars($_SESSION['message']) ?>
            </div>
            <?php unset($_SESSION['message']); ?>
        <?php endif; ?>
        
        <?php if (isset($_SESSION['error'])): ?>
            <div class="alert alert-danger">
                <?= htmlspecialchars($_SESSION['error']) ?>
            </div>
            <?php unset($_SESSION['error']); ?>
        <?php endif; ?>
        
        <div class="toolbar">
            <button class="btn btn-primary" onclick="openUploadModal()">
                <i class="fas fa-upload"></i> Subir Archivo
            </button>
            <button class="btn btn-success" onclick="openMkdirModal()">
                <i class="fas fa-folder-plus"></i> Nueva Carpeta
            </button>
            <button class="btn btn-secondary" onclick="location.reload()">
                <i class="fas fa-sync-alt"></i> Actualizar
            </button>
        </div>
        
        <div class="file-list">
            <?php if (empty($items)): ?>
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>Directorio vacío</h3>
                    <p>No hay archivos ni carpetas en este directorio.</p>
                </div>
            <?php else: ?>
                <?php foreach ($items as $item): ?>
                    <div class="file-item">
                        <div class="file-icon">
                            <?= $item['icon'] ?>
                        </div>
                        <div class="file-info">
                            <?php if ($item['is_dir']): ?>
                                <div class="file-name">
                                    <a href="?path=<?= urlencode($item['path']) ?>" style="color: inherit; text-decoration: none;">
                                        <?= htmlspecialchars($item['name']) ?>
                                    </a>
                                </div>
                            <?php else: ?>
                                <div class="file-name"><?= htmlspecialchars($item['name']) ?></div>
                            <?php endif; ?>
                            <div class="file-meta">
                                <?php if ($item['is_dir']): ?>
                                    Directorio
                                <?php else: ?>
                                    <?= formatFileSize($item['size']) ?> • 
                                    <?= date('d/m/Y H:i', $item['modified']) ?>
                                <?php endif; ?>
                            </div>
                        </div>
                        <div class="file-actions">
                            <?php if (!$item['is_dir']): ?>
                                <a href="/uploads/<?= str_replace($uploadDir . '/', '', $item['path']) ?>" 
                                   class="btn btn-primary" target="_blank">
                                    <i class="fas fa-download"></i>
                                </a>
                            <?php endif; ?>
                            <button class="btn btn-danger" onclick="deleteItem('<?= htmlspecialchars($item['name']) ?>')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
    
    <!-- Modal para subir archivo -->
    <div id="uploadModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-upload"></i> Subir Archivo</h3>
                <span class="close" onclick="closeModal('uploadModal')">&times;</span>
            </div>
            <form method="POST" enctype="multipart/form-data">
                <input type="hidden" name="action" value="upload">
                <div class="form-group">
                    <label for="file">Seleccionar archivo:</label>
                    <input type="file" id="file" name="file" required>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button type="submit" class="btn btn-primary">Subir</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal('uploadModal')">Cancelar</button>
                </div>
            </form>
        </div>
    </div>
    
    <!-- Modal para crear directorio -->
    <div id="mkdirModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-folder-plus"></i> Nueva Carpeta</h3>
                <span class="close" onclick="closeModal('mkdirModal')">&times;</span>
            </div>
            <form method="POST">
                <input type="hidden" name="action" value="mkdir">
                <div class="form-group">
                    <label for="dirname">Nombre de la carpeta:</label>
                    <input type="text" id="dirname" name="dirname" required>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button type="submit" class="btn btn-success">Crear</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal('mkdirModal')">Cancelar</button>
                </div>
            </form>
        </div>
    </div>
    
    <!-- Formulario para eliminar -->
    <form id="deleteForm" method="POST" style="display: none;">
        <input type="hidden" name="action" value="delete">
        <input type="hidden" name="file" id="deleteFileName">
    </form>
    
    <script>
        function openUploadModal() {
            document.getElementById('uploadModal').style.display = 'block';
        }
        
        function openMkdirModal() {
            document.getElementById('mkdirModal').style.display = 'block';
        }
        
        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
        
        function deleteItem(fileName) {
            if (confirm('¿Estás seguro de que quieres eliminar "' + fileName + '"?')) {
                document.getElementById('deleteFileName').value = fileName;
                document.getElementById('deleteForm').submit();
            }
        }
        
        // Cerrar modal al hacer clic fuera
        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        }
    </script>
</body>
</html> 