export function formatDate (isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  }

export function formatDateShort (dateString) {
    if (!dateString) return '-';
    
    // Si ya es un string en formato YYYY-MM-DD, devolverlo tal como está
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    
    // Si es una fecha válida, formatearla como YYYY-MM-DD
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}