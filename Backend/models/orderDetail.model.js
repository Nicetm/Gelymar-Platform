// models/orderDetail.model.js
class OrderDetail {
  constructor({
    id,
    order_id,
    incoterm = null,
    direccion_destino = null,
    puerto_destino = null,
    u_observaciones = null,
    fecha_eta = null,
    fecha_etd = null,
    certificados = null,
    pymnt_group = null,
    fec_deseada_dep_planta = null,
    fec_deseada_cliente = null,
    fec_real_dep_planta = null,
    fec_original_cliente = null,
    u_reserva = null,
    folio_gd = null,
    motivo_retraso = null,
    created_at = null,
    updated_at = null
  }) {
    this.id = id;
    this.order_id = order_id;
    this.incoterm = incoterm;
    this.direccion_destino = direccion_destino;
    this.puerto_destino = puerto_destino;
    this.u_observaciones = u_observaciones;
    this.fecha_eta = fecha_eta;
    this.fecha_etd = fecha_etd;
    this.certificados = certificados;
    this.pymnt_group = pymnt_group;
    this.fec_deseada_dep_planta = fec_deseada_dep_planta;
    this.fec_deseada_cliente = fec_deseada_cliente;
    this.fec_real_dep_planta = fec_real_dep_planta;
    this.fec_original_cliente = fec_original_cliente;
    this.u_reserva = u_reserva;
    this.folio_gd = folio_gd;
    this.motivo_retraso = motivo_retraso;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}

module.exports = OrderDetail; 