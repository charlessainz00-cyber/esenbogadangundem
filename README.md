# Link Sitesi — Haber Panosu

Bu klasör, mevcut Akış masaüstü uygulamasına dokunmadan `esenbogadangundem.netlify.app` sitesinin web arayüzünü geliştirmek için hazırlanmıştır.

## Özellikler

- X gönderileri dahil, her türlü `http` veya `https` haber bağlantısını kaydeder.
- Haberleri Hariciye ve Dahiliye kategorilerinde gösterir.
- Bir ana haberin altında birden fazla devam haberi tutar.
- Devam haberlerini ekleme, düzenleme ve silme işlemlerini ana habere bağlı saklar.
- Yönetici işlemleri `NEWS_ADMIN_KEY` ortam değişkeniyle korunur.
- Haber ve kategori verileri Netlify Blobs içinde saklanır.

## Yerelde çalıştırma

Node.js kurulu ortamda bu klasörde `npm install` ve sonra `npm run dev` çalıştırın. Yönetici paneli için `NEWS_ADMIN_KEY` ortam değişkenini Netlify Dev ortamına tanımlayın.

## Netlify dağıtımı

Netlify'daki mevcut `esenbogadangundem` sitesine bu klasörü dağıtın; ayrı bir Netlify sitesi açmak mevcut haber verilerini ayırır. Build komutu boş, publish directory `.` ve functions directory `netlify/functions` olmalıdır. Mevcut site ayarındaki `NEWS_ADMIN_KEY` korunmalıdır. Kaynak kod değişiklikleri burada hazırlanmıştır; bu çalışma klasöründe Git deposu veya Netlify dağıtım bağlantısı bulunmadığı için yayındaki siteye otomatik gönderilmez.
