const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
});

const defaultPriceList = {
  name: 'Hepsi',
  group: 'Genel',
  items: [
    { code: 'P001', name: 'PPRC 32 Boru', price: 100, image: '🔵' },
    { code: 'P002', name: 'PPRC 25 Boru', price: 72.5, image: '🟢' },
    { code: 'P003', name: 'PP-RC Dirsek 32', price: 21.35, image: '🟠' },
    { code: 'P004', name: 'PP-RC Dirsek 25', price: 16.2, image: '🟠' },
    { code: 'P005', name: 'Vanalar 1/2"', price: 55.9, image: '⚙️' },
    { code: 'P006', name: 'Temiz Su Kolektörü', price: 312.4, image: '💧' },
  ],
};

class PriceListStore {
  constructor() {
    const stored = localStorage.getItem('priceLists');
    this.lists = stored ? JSON.parse(stored) : [defaultPriceList];
    this.ensureItemIds();
    this.persist();
  }

  ensureItemIds() {
    this.lists = this.lists.map((list) => ({
      ...list,
      items: list.items.map((item) => ({ id: crypto.randomUUID(), ...item })),
    }));
  }

  persist() {
    localStorage.setItem('priceLists', JSON.stringify(this.lists));
  }

  addList(name, items, group = 'Genel') {
    const existingIndex = this.lists.findIndex((l) => l.name === name);
    const normalizedItems = items.map((item) => ({ id: crypto.randomUUID(), ...item }));
    if (existingIndex >= 0) {
      this.lists[existingIndex] = { name, group, items: normalizedItems };
    } else {
      this.lists.push({ name, group, items: normalizedItems });
    }
    this.persist();
  }

  getList(name) {
    return this.lists.find((l) => l.name === name);
  }

  allItems() {
    return this.lists.flatMap((l) => l.items);
  }
}

class OfferBuilder {
  constructor(store) {
    this.store = store;
    this.items = [];
    this.selectedId = null;
    this.archive = this.loadArchive();
    this.bindUI();
    this.renderPriceLists();
    this.renderArchive();
    this.updateTotals();
  }

  bindUI() {
    this.bodyEl = document.getElementById('itemsBody');
    this.emptyState = document.getElementById('emptyState');
    this.listSelect = document.getElementById('priceListSelect');
    this.globalDiscount = document.getElementById('globalDiscount');
    this.maturityDiff = document.getElementById('maturityDiff');
    this.paymentType = document.getElementById('paymentType');
    this.manageListSelect = document.getElementById('manageListSelect');
    this.listEditorBody = document.getElementById('listEditorBody');
    this.listEditorEmpty = document.getElementById('listEditorEmpty');

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.target));
    });

    document.querySelectorAll('.pill').forEach((btn) => {
      btn.addEventListener('click', () => this.handleConvert(btn.dataset.action));
    });

    document.getElementById('excelInput').addEventListener('change', (e) => this.handleExcel(e));
    document.getElementById('wordInput').addEventListener('change', (e) => this.handleWord(e));
    document.getElementById('imageInput').addEventListener('change', (e) => this.handleImage(e));

    document.getElementById('addEmptyItem').addEventListener('click', () => this.addEmptyItem());
    document.getElementById('deleteSelected').addEventListener('click', () => this.deleteSelected());
    document.getElementById('editSelected').addEventListener('click', () => this.focusSelected());

    this.globalDiscount.addEventListener('input', () => this.updateTotals());
    this.maturityDiff.addEventListener('input', () => this.updateTotals());
    this.paymentType.addEventListener('change', () => this.updateTotals());

    document.getElementById('generateOffer').addEventListener('click', () => this.generateOffer());
    document.getElementById('downloadExcel').addEventListener('click', () => this.downloadExcel());
    document.getElementById('downloadPdf').addEventListener('click', () => this.downloadPdf());
    document.getElementById('downloadWord').addEventListener('click', () => this.downloadWord());

    document.getElementById('saveList').addEventListener('click', () => this.saveUploadedList());
    document.getElementById('listUpload').addEventListener('change', (e) => this.previewListFile(e));
    this.manageListSelect.addEventListener('change', () => this.renderListEditor());
    document.getElementById('bulkDeleteItems').addEventListener('click', () => this.bulkDeleteSelected());
    document.getElementById('saveEdits').addEventListener('click', () => this.persistEditedRows());
    document.getElementById('toggleAllRows').addEventListener('change', (e) => this.toggleAllRows(e.target.checked));
  }

  switchTab(target) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.target === target));
    document.querySelectorAll('.page').forEach((page) => {
      const isTarget = page.id === target;
      page.classList.toggle('hidden', !isTarget);
      page.setAttribute('aria-hidden', (!isTarget).toString());
    });
  }

  renderPriceLists() {
    this.listSelect.innerHTML = '';
    this.store.lists.forEach((list) => {
      const option = document.createElement('option');
      option.value = list.name;
      option.textContent = `${list.name} (${list.group || 'Genel'})`;
      this.listSelect.appendChild(option);
    });

    const overview = document.getElementById('listOverview');
    overview.innerHTML = '';
    this.store.lists.forEach((list) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      li.innerHTML = `<h5>${list.name}</h5><small>${list.group || 'Genel'}</small><div class="badge">${list.items.length} ürün</div>`;
      overview.appendChild(li);
    });

    this.manageListSelect.innerHTML = '';
    this.store.lists.forEach((list) => {
      const option = document.createElement('option');
      option.value = list.name;
      option.textContent = `${list.name} (${list.group || 'Genel'})`;
      this.manageListSelect.appendChild(option);
    });
    this.renderListEditor();
  }

  renderArchive() {
    const container = document.getElementById('archiveList');
    container.innerHTML = '';
    if (!this.archive.length) {
      container.innerHTML = '<p class="muted">Henüz teklif oluşturulmadı.</p>';
      return;
    }
    this.archive.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'archive-card';
      card.innerHTML = `
        <div class="badge">${entry.date}</div>
        <h4>${entry.title}</h4>
        <p class="muted">${entry.items.length} satır - ${currencyFormatter.format(entry.grandTotal)}</p>
      `;
      container.appendChild(card);
    });
  }

  addItem(item) {
    this.items.push({ ...item, id: crypto.randomUUID() });
    this.renderItems();
  }

  addEmptyItem() {
    this.addItem({
      code: '',
      name: 'Yeni Ürün',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      vat: 20,
    });
  }

  deleteSelected() {
    if (!this.selectedId) return;
    this.items = this.items.filter((i) => i.id !== this.selectedId);
    this.selectedId = null;
    this.renderItems();
  }

  focusSelected() {
    if (!this.selectedId) return;
    const row = document.querySelector(`[data-id="${this.selectedId}"]`);
    const input = row?.querySelector('input');
    input?.focus();
  }

  renderItems() {
    this.bodyEl.innerHTML = '';
    this.emptyState.style.display = this.items.length ? 'none' : 'block';
    if (!this.items.length) {
      document.getElementById('editSelected').disabled = true;
      document.getElementById('deleteSelected').disabled = true;
      return;
    }

    this.items.forEach((item) => {
      const row = document.createElement('tr');
      row.className = 'table-row';
      row.dataset.id = item.id;
      row.addEventListener('click', () => this.handleSelect(item.id));

      row.innerHTML = `
        <td>${item.code || '—'}</td>
        <td>${item.name}</td>
        <td><input class="line-input" type="number" min="0" value="${item.quantity}" data-field="quantity" /></td>
        <td><input class="line-input" type="number" min="0" step="0.01" value="${item.unitPrice}" data-field="unitPrice" /></td>
        <td><input class="line-input" type="number" min="0" max="100" value="${item.discount || 0}" data-field="discount" /></td>
        <td><input class="line-input" type="number" min="0" max="100" value="${item.vat}" data-field="vat" /></td>
        <td class="line-total">${currencyFormatter.format(this.computeLineTotal(item))}</td>
      `;

      row.querySelectorAll('input').forEach((input) => {
        input.addEventListener('input', (ev) => this.updateItemField(item.id, ev));
      });

      if (item.id === this.selectedId) {
        row.classList.add('selected');
      }

      this.bodyEl.appendChild(row);
    });

    document.getElementById('editSelected').disabled = !this.selectedId;
    document.getElementById('deleteSelected').disabled = !this.selectedId;
    this.updateTotals();
  }

  handleSelect(id) {
    this.selectedId = this.selectedId === id ? null : id;
    this.renderItems();
  }

  updateItemField(id, event) {
    const field = event.target.dataset.field;
    const value = parseFloat(event.target.value) || 0;
    this.items = this.items.map((item) => (item.id === id ? { ...item, [field]: value } : item));
    const row = document.querySelector(`[data-id="${id}"] .line-total`);
    const current = this.items.find((i) => i.id === id);
    if (row && current) row.textContent = currencyFormatter.format(this.computeLineTotal(current));
    this.updateTotals();
  }

  computeLineTotal(item) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const lineDiscount = Number(item.discount) || 0;
    const vat = Number(item.vat) || 0;

    const raw = qty * price;
    const afterLineDiscount = raw * (1 - lineDiscount / 100);
    const afterGlobal = afterLineDiscount * (1 - (Number(this.globalDiscount.value) || 0) / 100);
    const vatValue = afterGlobal * (vat / 100);
    return afterGlobal + vatValue;
  }

  updateTotals() {
    const totals = this.items.reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const lineDiscount = Number(item.discount) || 0;
        const vat = Number(item.vat) || 0;
        const raw = qty * price;
        const afterLineDiscount = raw * (1 - lineDiscount / 100);
        acc.subtotal += afterLineDiscount;
        const afterGlobal = afterLineDiscount * (1 - (Number(this.globalDiscount.value) || 0) / 100);
        acc.vat += afterGlobal * (vat / 100);
        acc.totalAfterDiscount += afterGlobal;
        return acc;
      },
      { subtotal: 0, vat: 0, totalAfterDiscount: 0 }
    );

    const maturityValue = (totals.totalAfterDiscount + totals.vat) * ((Number(this.maturityDiff.value) || 0) / 100);

    document.getElementById('subtotal').textContent = currencyFormatter.format(totals.subtotal);
    document.getElementById('vatTotal').textContent = currencyFormatter.format(totals.vat);
    document.getElementById('maturityTotal').textContent = currencyFormatter.format(maturityValue);
    document.getElementById('grandTotal').textContent = currencyFormatter.format(totals.totalAfterDiscount + totals.vat + maturityValue);
  }

  handleConvert(action) {
    const uploadHint = document.getElementById('uploadHint');
    switch (action) {
      case 'excel':
        document.getElementById('excelInput').click();
        break;
      case 'word':
        document.getElementById('wordInput').click();
        break;
      case 'photo':
        document.getElementById('imageInput').click();
        break;
      case 'text': {
        const text = document.getElementById('customerRequest').value;
        this.convertFromText(text);
        uploadHint.textContent = 'Yazıdan dönüştürüldü.';
        break;
      }
      default:
        break;
    }
  }

  convertFromText(text) {
    const lines = text
      .split(/\n|,/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const requests = lines.map((line) => ({
      quantity: this.extractQuantity(line),
      query: line,
    }));
    const matchedItems = this.matchRequests(requests);
    matchedItems.forEach((item) => this.addItem(item));
  }

  extractQuantity(text) {
    const match = text.match(/(\d+[\.,]?\d*)/);
    if (!match) return 1;
    return parseFloat(match[1].replace(',', '.'));
  }

  normalize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9çğıöşü\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  score(query, candidate) {
    const qTokens = this.normalize(query).split(' ');
    const cTokens = this.normalize(candidate).split(' ');
    const common = qTokens.filter((t) => cTokens.includes(t)).length;
    return common / Math.max(cTokens.length, 1);
  }

  matchRequests(requests) {
    const selectedList = this.store.getList(this.listSelect.value) || defaultPriceList;
    const searchableItems = selectedList.name === 'Hepsi' ? this.store.allItems() : selectedList.items;

    return requests.map((req) => {
      let best = null;
      let bestScore = 0;
      searchableItems.forEach((item) => {
        const s = this.score(req.query, `${item.code} ${item.name}`);
        if (s > bestScore) {
          bestScore = s;
          best = item;
        }
      });

      const resolved = best || searchableItems[0];
      return {
        code: resolved.code,
        name: resolved.name,
        quantity: req.quantity || 1,
        unitPrice: resolved.price,
        discount: 0,
        vat: 20,
      };
    });
  }

  async handleExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const text = rows.flat().join('\n');
    document.getElementById('customerRequest').value = text;
    document.getElementById('uploadHint').textContent = `${file.name} yüklendi.`;
    this.convertFromText(text);
    event.target.value = '';
  }

  async handleWord(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    document.getElementById('customerRequest').value = text;
    document.getElementById('uploadHint').textContent = `${file.name} yüklendi.`;
    this.convertFromText(text);
    event.target.value = '';
  }

  async handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await this.readAsDataURL(file);
    document.getElementById('uploadHint').textContent = `${file.name} OCR ile okunuyor...`;
    try {
      const { data } = await Tesseract.recognize(dataUrl, 'tur');
      const text = data.text;
      document.getElementById('customerRequest').value = text;
      this.convertFromText(text);
      document.getElementById('uploadHint').textContent = `${file.name} başarıyla dönüştürüldü.`;
    } catch (error) {
      console.error(error);
      document.getElementById('uploadHint').textContent = 'Görsel okunurken hata oluştu.';
    }
    event.target.value = '';
  }

  readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  generateOffer() {
    if (!this.items.length) return alert('Liste boş. Önce ürün ekleyin.');
    const grand = document.getElementById('grandTotal').textContent;
    const entry = {
      title: 'Teklif #' + (this.archive.length + 1),
      date: new Date().toLocaleString('tr-TR'),
      items: this.items,
      grandTotal: this.items.reduce((acc, i) => acc + this.computeLineTotal(i), 0),
    };
    this.archive.unshift(entry);
    localStorage.setItem('offerArchive', JSON.stringify(this.archive));
    this.renderArchive();
    alert(`Teklif oluşturuldu. Genel toplam: ${grand}`);
  }

  loadArchive() {
    const stored = localStorage.getItem('offerArchive');
    return stored ? JSON.parse(stored) : [];
  }

  collectTableData() {
    const maturity = Number(this.maturityDiff.value) || 0;
    const globalDiscount = Number(this.globalDiscount.value) || 0;
    const payment = this.paymentType.value;
    const totals = {
      subtotal: document.getElementById('subtotal').textContent,
      vat: document.getElementById('vatTotal').textContent,
      maturity: document.getElementById('maturityTotal').textContent,
      grand: document.getElementById('grandTotal').textContent,
    };
    return { maturity, globalDiscount, payment, totals };
  }

  downloadExcel() {
    if (!this.items.length) return alert('Liste boş.');
    const data = [
      ['Ürün Kodu', 'Ürün Adı', 'Adet', 'Birim Fiyat', 'İskonto', 'KDV', 'Toplam'],
      ...this.items.map((i) => [
        i.code,
        i.name,
        i.quantity,
        i.unitPrice,
        `${i.discount || 0}%`,
        `${i.vat}%`,
        currencyFormatter.format(this.computeLineTotal(i)),
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Teklif');
    XLSX.writeFile(wb, 'teklif.xlsx');
  }

  downloadPdf() {
    if (!this.items.length) return alert('Liste boş.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Teklif Özeti', 14, 16);
    doc.setFontSize(10);

    let y = 26;
    this.items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.code} - ${item.name}`, 14, y);
      doc.text(`Adet: ${item.quantity} | Fiyat: ${item.unitPrice} | KDV: ${item.vat}%`, 14, y + 6);
      doc.text(`Satır Toplamı: ${currencyFormatter.format(this.computeLineTotal(item))}`, 14, y + 12);
      y += 18;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    const { totals } = this.collectTableData();
    doc.text(`Ara Toplam: ${totals.subtotal}`, 14, y + 6);
    doc.text(`KDV: ${totals.vat}`, 14, y + 12);
    doc.text(`Vade Farkı: ${totals.maturity}`, 14, y + 18);
    doc.setFontSize(12);
    doc.text(`Genel Toplam: ${totals.grand}`, 14, y + 28);

    doc.save('teklif.pdf');
  }

  downloadWord() {
    if (!this.items.length) return alert('Liste boş.');
    const { totals, payment, maturity, globalDiscount } = this.collectTableData();
    const rows = this.items
      .map(
        (i) => `
        <tr>
          <td>${i.code}</td>
          <td>${i.name}</td>
          <td>${i.quantity}</td>
          <td>${i.unitPrice}</td>
          <td>${i.discount || 0}%</td>
          <td>${i.vat}%</td>
          <td>${currencyFormatter.format(this.computeLineTotal(i))}</td>
        </tr>`
      )
      .join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Teklif</title></head>
      <body>
        <h2>Teklif Özeti</h2>
        <p>Ödeme: ${payment} | Genel İskonto: ${globalDiscount}% | Vade Farkı: ${maturity}%</p>
        <table border="1" cellspacing="0" cellpadding="6">
          <thead><tr><th>Ürün Kodu</th><th>Ürün Adı</th><th>Adet</th><th>Birim Fiyat</th><th>İskonto</th><th>KDV</th><th>Toplam</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <h3>Ara Toplam: ${totals.subtotal}</h3>
        <h3>KDV: ${totals.vat}</h3>
        <h3>Vade Farkı: ${totals.maturity}</h3>
        <h2>Genel Toplam: ${totals.grand}</h2>
      </body>
      </html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'teklif.doc';
    link.click();
    URL.revokeObjectURL(url);
  }

  async previewListFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    document.getElementById('uploadHint').textContent = `${file.name} seçildi.`;
  }

  async saveUploadedList() {
    const name = document.getElementById('newListName').value.trim();
    const group = document.getElementById('newListGroup').value.trim() || 'Genel';
    const fileInput = document.getElementById('listUpload');
    const file = fileInput.files?.[0];

    if (!name || !file) {
      alert('Liste adı ve dosyası gerekli.');
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const items = rows
      .filter((r) => r.length >= 3)
      .map((r) => ({ code: r[0], name: r[1], price: Number(r[2]) || 0 }));

    this.store.addList(name, items, group);
    this.renderPriceLists();
    fileInput.value = '';
    document.getElementById('newListName').value = '';
    document.getElementById('newListGroup').value = '';
    alert(`${name} listesi eklendi (${items.length} ürün).`);
  }

  renderListEditor() {
    const list = this.store.getList(this.manageListSelect.value);
    this.listEditorBody.innerHTML = '';
    if (!list || !list.items.length) {
      this.listEditorEmpty.style.display = 'block';
      return;
    }
    this.listEditorEmpty.style.display = 'none';
    list.items.forEach((item) => {
      const row = document.createElement('tr');
      row.dataset.id = item.id;
      row.innerHTML = `
        <td><input type="checkbox" data-row-select /></td>
        <td><input type="text" value="${item.code}" data-field="code" /></td>
        <td><input type="text" value="${item.name}" data-field="name" /></td>
        <td><input type="number" step="0.01" min="0" value="${item.price}" data-field="price" /></td>
      `;
      row.querySelectorAll('input[type=\"text\"], input[type=\"number\"]').forEach((input) => {
        input.addEventListener('input', () => this.markRowEdited(item.id, input.dataset.field, input.value));
      });
      row.querySelector('[data-row-select]').addEventListener('change', () => this.syncToggleAllCheckbox());
      this.listEditorBody.appendChild(row);
    });
    this.syncToggleAllCheckbox();
  }

  markRowEdited(id, field, value) {
    const list = this.store.getList(this.manageListSelect.value);
    if (!list) return;
    list.items = list.items.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: field === 'price' ? Number(value) || 0 : value };
      return updated;
    });
    this.store.persist();
  }

  toggleAllRows(checked) {
    this.listEditorBody.querySelectorAll('input[type=\"checkbox\"][data-row-select]').forEach((cb) => {
      cb.checked = checked;
    });
  }

  syncToggleAllCheckbox() {
    const rows = this.listEditorBody.querySelectorAll('input[type=\"checkbox\"][data-row-select]');
    const allChecked = rows.length && Array.from(rows).every((cb) => cb.checked);
    document.getElementById('toggleAllRows').checked = allChecked;
  }

  bulkDeleteSelected() {
    const list = this.store.getList(this.manageListSelect.value);
    if (!list) return;
    const selectedIds = Array.from(this.listEditorBody.querySelectorAll('input[data-row-select]:checked')).map(
      (cb) => cb.closest('tr').dataset.id
    );
    if (!selectedIds.length) {
      alert('Silmek için ürün seçin.');
      return;
    }
    list.items = list.items.filter((item) => !selectedIds.includes(item.id));
    this.store.persist();
    this.renderPriceLists();
  }

  persistEditedRows() {
    alert('Değişiklikler kaydedildi.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OfferBuilder(new PriceListStore());
});
