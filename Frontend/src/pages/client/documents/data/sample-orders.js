/**
 * Sample Orders
 * Campo `lastUpdated` en ISO string.
 * Ajusta / reemplaza con fetch real más adelante.
 */

// Función para calcular la fecha más reciente de los documentos
function getLatestDocumentDate(orderId, docsByOrder) {
  const documents = docsByOrder[orderId] || [];
  if (documents.length === 0) return new Date().toISOString();
  
  const dates = documents.map(doc => new Date(doc.updated));
  const latestDate = new Date(Math.max(...dates));
  return latestDate.toISOString();
}

// Importar los documentos para calcular las fechas
import docsByOrder from './sample-documents.js';

const orders = [
    {
      id: 1,
      orderNumber: "ORD-2024-001",
      clientName: "Oceanic Freight Ltd",
      status: "In Progress",
      documents: 8,
      lastUpdated: getLatestDocumentDate(1, docsByOrder),
      priority: "high"
    },
    {
      id: 2,
      orderNumber: "ORD-2024-002",
      clientName: "Maritime Solutions Inc",
      status: "Completed",
      documents: 6,
      lastUpdated: getLatestDocumentDate(2, docsByOrder),
      priority: "medium"
    },
    {
      id: 3,
      orderNumber: "ORD-2024-003",
      clientName: "Global Shipping Co",
      status: "Pending",
      documents: 6,
      lastUpdated: getLatestDocumentDate(3, docsByOrder),
      priority: "low"
    },
    {
      id: 4,
      orderNumber: "ORD-2024-004",
      clientName: "International Cargo",
      status: "In Progress",
      documents: 8,
      lastUpdated: getLatestDocumentDate(4, docsByOrder),
      priority: "high"
    }
  ];
  
  export default orders;