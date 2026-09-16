/**
 * Thermal Receipt Printer & FIFO Print Queue
 * Supports duplicate-print protection, thermal receipt formatting, and modular printer adapters.
 */

export interface ReceiptOrderItem {
  name: string;
  quantity: number;
  price?: number;
}

export interface ReceiptOrderData {
  id: string | number;
  token_number?: string | number | null;
  customer_name?: string;
  created_at?: string;
  total_amount?: string | number;
  items: ReceiptOrderItem[];
}

export interface PrinterAdapter {
  name: string;
  printReceipt(receiptText: string, order: ReceiptOrderData): Promise<boolean>;
}

// Format 80mm/58mm thermal receipt text
export function formatThermalReceipt(order: ReceiptOrderData): string {
  const token = order.token_number ? `#${order.token_number}` : `#${order.id}`;
  const width = 32; // Standard column width for 58mm/80mm thermal paper

  const center = (str: string) => {
    const pad = Math.max(0, Math.floor((width - str.length) / 2));
    return ' '.repeat(pad) + str;
  };

  const line = '-'.repeat(width);

  let body = '';
  body += center('BHUKKADBOX') + '\n';
  body += center(`TOKEN ${token}`) + '\n';
  body += line + '\n\n';

  for (const item of order.items) {
    const nameStr = item.name.length > 22 ? item.name.slice(0, 22) : item.name;
    const qtyStr = `x ${item.quantity}`;
    const leftPad = width - nameStr.length - qtyStr.length;
    const itemLine = nameStr + ' '.repeat(Math.max(1, leftPad)) + qtyStr;
    body += itemLine + '\n';
  }

  body += '\n' + line + '\n\n';
  body += center('ALREADY PAID') + '\n';

  return body;
}

// Browser Print Adapter (Default fallback using printable DOM frame)
export class BrowserPrintAdapter implements PrinterAdapter {
  name = 'Browser HTML/Print';

  async printReceipt(receiptText: string, order: ReceiptOrderData): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (typeof window === 'undefined') {
          resolve(false);
          return;
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = '0';

        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          resolve(false);
          return;
        }

        const tokenStr = order.token_number ? `#${order.token_number}` : `#${order.id}`;

        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Receipt - Token ${tokenStr}</title>
              <style>
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                body {
                  font-family: 'Courier New', Courier, monospace;
                  font-size: 14px;
                  font-weight: bold;
                  width: 76mm;
                  margin: 0 auto;
                  padding: 10px 5px;
                  color: #000;
                  background: #fff;
                  line-height: 1.3;
                }
                .text-center { text-align: center; }
                .divider { border-top: 1px dashed #000; margin: 8px 0; }
                .header-title { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
                .token-box { font-size: 24px; font-weight: 900; margin: 6px 0; }
                .item-row { display: flex; justify-content: space-between; margin: 4px 0; }
                .paid-badge { 
                  border: 2px solid #000; 
                  padding: 4px 8px; 
                  display: inline-block; 
                  font-size: 16px; 
                  font-weight: 900;
                  margin-top: 8px; 
                }
              </style>
            </head>
            <body>
              <div class="text-center header-title">BHUKKADBOX</div>
              <div class="text-center token-box">TOKEN ${tokenStr}</div>
              <div class="divider"></div>
              
              <div style="margin: 8px 0;">
                ${order.items.map(item => `
                  <div class="item-row">
                    <span>${item.name}</span>
                    <span>× ${item.quantity}</span>
                  </div>
                `).join('')}
              </div>

              <div class="divider"></div>
              <div class="text-center">
                <span class="paid-badge">ALREADY PAID</span>
              </div>
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error('Print trigger error:', e);
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              resolve(true);
            }, 500);
          }
        }, 250);
      } catch (err) {
        console.error('BrowserPrintAdapter error:', err);
        resolve(false);
      }
    });
  }
}

// Modular Web-Bluetooth / Web-Serial Thermal Printer Adapter stub for future extension
export class WebBluetoothPrinterAdapter implements PrinterAdapter {
  name = 'Web Bluetooth Thermal Printer';

  async printReceipt(receiptText: string, order: ReceiptOrderData): Promise<boolean> {
    console.log('[WebBluetoothPrinterAdapter] Thermal printing text:\n', receiptText);
    return true;
  }
}

// FIFO Print Queue
class ReceiptPrintQueue {
  private queue: ReceiptOrderData[] = [];
  private isProcessing = false;
  private printedIds = new Set<string>();
  private activeAdapter: PrinterAdapter = new BrowserPrintAdapter();

  constructor() {
    try {
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('bhukkad_printed_orders');
        if (stored) {
          const ids: string[] = JSON.parse(stored);
          ids.forEach(id => this.printedIds.add(id));
        }
      }
    } catch (_) {}
  }

  public setAdapter(adapter: PrinterAdapter) {
    this.activeAdapter = adapter;
  }

  public enqueueOrder(order: ReceiptOrderData): boolean {
    if (!order || !order.id || !order.items || order.items.length === 0) {
      return false;
    }

    const orderIdStr = String(order.id);
    if (this.printedIds.has(orderIdStr)) {
      console.log(`[ReceiptPrintQueue] Duplicate order #${orderIdStr} ignored (already printed).`);
      return false;
    }

    if (this.queue.some(o => String(o.id) === orderIdStr)) {
      console.log(`[ReceiptPrintQueue] Order #${orderIdStr} already in queue.`);
      return false;
    }

    this.queue.push(order);
    this.processQueue();
    return true;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const order = this.queue.shift();
      if (!order) continue;

      const orderIdStr = String(order.id);
      if (this.printedIds.has(orderIdStr)) continue;

      const receiptText = formatThermalReceipt(order);

      try {
        await this.activeAdapter.printReceipt(receiptText, order);
        this.printedIds.add(orderIdStr);
        this.savePrintedIds();
      } catch (err) {
        console.error(`[ReceiptPrintQueue] Failed printing order #${orderIdStr}:`, err);
      }
    }

    this.isProcessing = false;
  }

  private savePrintedIds() {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bhukkad_printed_orders', JSON.stringify(Array.from(this.printedIds)));
      }
    } catch (_) {}
  }

  public resetQueue() {
    this.queue = [];
    this.printedIds.clear();
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('bhukkad_printed_orders');
      }
    } catch (_) {}
  }
}

export const receiptPrintQueue = new ReceiptPrintQueue();
