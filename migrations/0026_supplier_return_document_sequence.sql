ALTER TABLE document_number_sequences
  DROP CONSTRAINT document_number_sequences_document_type_check,
  ADD CONSTRAINT document_number_sequences_document_type_check
    CHECK (document_type IN (
      'invoice', 'purchase_request', 'purchase_order', 'inventory_transfer',
      'goods_receipt', 'supplier_return', 'receipt'
    ));

INSERT INTO document_number_sequences (document_type, prefix, next_number)
VALUES ('supplier_return', 'SRN', 1)
ON CONFLICT DO NOTHING;
