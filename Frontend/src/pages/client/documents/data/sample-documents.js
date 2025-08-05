/**
 * Sample Documents agrupados por ID de orden.
 * Campos:
 *  id, name, category, size, updated (ISO), status ('Unread'|'Viewed'|'Reviewed'),
 *  type ('pdf'|'doc'|'img'|...), public (boolean)
 */

const docsByOrder = {
    1: [
      {
        id: 1,
        name: "Invoice_2024_001.pdf",
        category: "Billing",
        size: "2.4 MB",
        updated: new Date().toISOString(), // hoy
        status: "Unread",
        type: "pdf",
        public: true
      },
      {
        id: 2,
        name: "Service_Contract.docx",
        category: "Contracts",
        size: "1.8 MB",
        updated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // hace 2 horas
        status: "Viewed",
        type: "doc",
        public: false
      },
      {
        id: 3,
        name: "Quality_Certificate.jpg",
        category: "Certificates",
        size: "3.2 MB",
        updated: "2024-12-13T16:45:00Z",
        status: "Reviewed",
        type: "img",
        public: true
      },
      {
        id: 4,
        name: "Procedures_Manual.pdf",
        category: "Manuals",
        size: "5.1 MB",
        updated: "2024-11-20T11:20:00Z",
        status: "Reviewed",
        type: "pdf",
        public: true
      },
      {
        id: 5,
        name: "Safety_Guidelines.pdf",
        category: "Safety",
        size: "1.5 MB",
        updated: "2024-12-14T09:15:00Z",
        status: "Unread",
        type: "pdf",
        public: true
      },
      {
        id: 6,
        name: "Equipment_List.xlsx",
        category: "Inventory",
        size: "0.8 MB",
        updated: "2024-12-12T14:30:00Z",
        status: "Viewed",
        type: "xlsx",
        public: false
      },
      {
        id: 7,
        name: "Training_Video.mp4",
        category: "Training",
        size: "45.2 MB",
        updated: "2024-12-10T11:45:00Z",
        status: "Reviewed",
        type: "vid",
        public: true
      },
      {
        id: 8,
        name: "Maintenance_Log.pdf",
        category: "Maintenance",
        size: "2.7 MB",
        updated: "2024-12-11T16:20:00Z",
        status: "Viewed",
        type: "pdf",
        public: false
      }
    ],
    2: [
      {
        id: 9,
        name: "Financial_Report_2024.pdf",
        category: "Reports",
        size: "4.2 MB",
        updated: "2024-12-11T13:55:00Z",
        status: "Reviewed",
        type: "pdf",
        public: false
      },
      {
        id: 10,
        name: "Company_Policy.docx",
        category: "Policies",
        size: "2.1 MB",
        updated: "2024-12-01T10:30:00Z",
        status: "Reviewed",
        type: "doc",
        public: true
      },
      {
        id: 11,
        name: "Budget_2024.xlsx",
        category: "Finance",
        size: "1.9 MB",
        updated: "2024-12-13T08:45:00Z",
        status: "Unread",
        type: "xlsx",
        public: false
      },
      {
        id: 12,
        name: "Audit_Report.pdf",
        category: "Audit",
        size: "3.8 MB",
        updated: "2024-12-09T15:30:00Z",
        status: "Reviewed",
        type: "pdf",
        public: false
      },
      {
        id: 13,
        name: "Tax_Documents.zip",
        category: "Tax",
        size: "12.5 MB",
        updated: "2024-12-08T12:15:00Z",
        status: "Viewed",
        type: "zip",
        public: false
      },
      {
        id: 14,
        name: "Insurance_Certificate.pdf",
        category: "Insurance",
        size: "1.2 MB",
        updated: "2024-12-07T09:20:00Z",
        status: "Reviewed",
        type: "pdf",
        public: true
      }
    ],
    3: [
      {
        id: 15,
        name: "Product_Catalog.jpg",
        category: "Marketing",
        size: "6.8 MB",
        updated: "2024-12-08T15:10:00Z",
        status: "Reviewed",
        type: "img",
        public: false
      },
      {
        id: 16,
        name: "Training_Material.pdf",
        category: "Training",
        size: "3.5 MB",
        updated: "2024-12-13T08:25:00Z",
        status: "Viewed",
        type: "pdf",
        public: true
      },
      {
        id: 17,
        name: "Marketing_Presentation.pptx",
        category: "Marketing",
        size: "8.3 MB",
        updated: "2024-12-12T10:40:00Z",
        status: "Unread",
        type: "ppt",
        public: true
      },
      {
        id: 18,
        name: "Brand_Guidelines.pdf",
        category: "Branding",
        size: "4.7 MB",
        updated: "2024-12-10T14:55:00Z",
        status: "Reviewed",
        type: "pdf",
        public: true
      },
      {
        id: 19,
        name: "Social_Media_Plan.docx",
        category: "Marketing",
        size: "2.3 MB",
        updated: "2024-12-11T11:30:00Z",
        status: "Viewed",
        type: "doc",
        public: false
      },
      {
        id: 20,
        name: "Event_Photos.zip",
        category: "Events",
        size: "25.8 MB",
        updated: "2024-12-09T16:45:00Z",
        status: "Reviewed",
        type: "zip",
        public: true
      }
    ],
    4: [
      {
        id: 21,
        name: "Shipping_Manifest.pdf",
        category: "Shipping",
        size: "3.8 MB",
        updated: "2024-12-14T10:20:00Z",
        status: "Unread",
        type: "pdf",
        public: true
      },
      {
        id: 22,
        name: "Customs_Declaration.docx",
        category: "Customs",
        size: "2.5 MB",
        updated: "2024-12-12T11:30:00Z",
        status: "Viewed",
        type: "doc",
        public: false
      },
      {
        id: 23,
        name: "Cargo_Insurance.pdf",
        category: "Insurance",
        size: "1.6 MB",
        updated: "2024-12-13T13:15:00Z",
        status: "Reviewed",
        type: "pdf",
        public: true
      },
      {
        id: 24,
        name: "Port_Authorities.pdf",
        category: "Authorities",
        size: "2.9 MB",
        updated: "2024-12-11T09:45:00Z",
        status: "Viewed",
        type: "pdf",
        public: false
      },
      {
        id: 25,
        name: "Container_List.xlsx",
        category: "Inventory",
        size: "1.1 MB",
        updated: "2024-12-10T15:20:00Z",
        status: "Unread",
        type: "xlsx",
        public: false
      },
      {
        id: 26,
        name: "Delivery_Confirmation.pdf",
        category: "Delivery",
        size: "0.9 MB",
        updated: "2024-12-09T12:10:00Z",
        status: "Reviewed",
        type: "pdf",
        public: true
      },
      {
        id: 27,
        name: "Quality_Control_Report.pdf",
        category: "Quality",
        size: "3.4 MB",
        updated: "2024-12-08T14:30:00Z",
        status: "Viewed",
        type: "pdf",
        public: false
      },
      {
        id: 28,
        name: "Safety_Compliance.pdf",
        category: "Safety",
        size: "2.2 MB",
        updated: "2024-12-07T11:25:00Z",
        status: "Reviewed",
        type: "pdf",
        public: true
      }
    ]
  };
  
  export default docsByOrder;