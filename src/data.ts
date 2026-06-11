import { Hotspot, QuizQuestion } from './types';

export const HOTSPOTS: Hotspot[] = [
  {
    id: 'waduk',
    name: 'Waduk (Reservoir)',
    titleIndonesian: 'Waduk / Bendungan',
    description: 'Danau buatan berukuran besar yang menampung air sungai. Berfungsi menyimpan energi potensial air dalam jumlah besar serta menciptakan perbedaan tinggi (head) yang esensial untuk menggerakkan air ke bawah.',
    coordinate: { x: 120, y: 180 }
  },
  {
    id: 'intake',
    name: 'Jalur Masuk (Intake Gate)',
    titleIndonesian: 'Pintu Masuk & Katup',
    description: 'Gerbang masuk air dari waduk ke dalam pipa pesat. Memiliki saringan penahan sampah alami dan pintu air hidrolis yang bisa dibuka-tutup untuk mengatur aliran air atau menghentikannya saat pemeliharaan.',
    coordinate: { x: 230, y: 220 }
  },
  {
    id: 'penstock',
    name: 'Pipa Pesat (Penstock)',
    titleIndonesian: 'Pipa Pesat (Penstock)',
    description: 'Pipa baja tebal yang dipasang miring dengan sudut curam. Mengalirkan air bertekanan tinggi dari waduk ke turbin, mengonversi energi potensial air menjadi energi kinetik (kecepatan aliran) yang optimal.',
    coordinate: { x: 420, y: 390 }
  },
  {
    id: 'turbin',
    name: 'Turbin Reaksi (Turbine)',
    titleIndonesian: 'Turbin Air',
    description: 'Kincir baja khusus yang diputar oleh dorongan dan tekanan air dari pipa pesat. Mengubah energi kinetik air menjadi energi mekanis putaran poros dengan efisiensi tinggi (bisa melebihi 90%).',
    coordinate: { x: 676, y: 454 }
  },
  {
    id: 'generator',
    name: 'Generator',
    titleIndonesian: 'Generator Utama',
    description: 'Mengubah energi mekanik putaran poros turbin menjadi energi listrik AC. Rotor bermagnet kuat berputar di dalam kumparan tembaga (stator), menciptakan gaya gerak listrik akibat induksi elektromagnetik.',
    coordinate: { x: 676, y: 345 }
  },
  {
    id: 'gardu',
    name: 'Gardu Listrik (Power House)',
    titleIndonesian: 'Rumah Pembangkit (Power House)',
    description: 'Struktur bangunan kokoh di atas tanah yang melindungi mesin generator, turbin, sistem kontrol otomatis, penyeimbang beban, dan panel kontrol duga dari guncangan, kelembapan, serta cuaca ekstrem.',
    coordinate: { x: 740, y: 280 }
  },
  {
    id: 'transformator',
    name: 'Transformator (Step-Up)',
    titleIndonesian: 'Trafo Pengungkit Tegangan',
    description: 'Komponen yang menaikkan tegangan listrik menengah (misal 11 kV - 25 kV) dari generator menjadi tegangan ekstra tinggi (150 kV - 500 kV) guna meminimalisir rugi daya (losses) akibat hambatan kabel selama transmisi.',
    coordinate: { x: 808, y: 298 }
  },
  {
    id: 'transmisi',
    name: 'Jalur Transmisi (SUTET)',
    titleIndonesian: 'Transmisi Udara (SUTET)',
    description: 'Jaringan kabel udara bertegangan ekstra tinggi yang membentang di menara transmisi baja (Sutet). Mendistribusikan energi listrik dari gardu PLTA melintasi bukit dan hutan menuju pusat-pusat kota/beban industri.',
    coordinate: { x: 530, y: 50 }
  },
  {
    id: 'tailrace',
    name: 'Jalur Keluar (Tailrace)',
    titleIndonesian: 'Saluran Pembuangan (Tailrace)',
    description: 'Saluran yang mengalirkan air bekas putaran turbin kembali ke badan sungai alami di hilir bendungan dengan aman. Menstabilkan arus agar tidak mengikis pondasi bendung atau merusak ekosistem sungai.',
    coordinate: { x: 860, y: 460 }
  }
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Dari manakah asal energi potensial utama yang menggerakkan sistem PLTA?',
    options: [
      'Putaran magnet generator di kumparan stator',
      'Perbedaan ketinggian permukaan air waduk dengan posisi turbin (head)',
      'Tekanan udara di dalam pipa pesat penstock',
      'Peralatan listrik transformator step-up'
    ],
    correctIndex: 1,
    explanation: 'Energi potensial utama didapat dari akumulasi tinggi jatuhnya air (head), yaitu letak ketinggian air waduk terhadap posisi turbin di bawah bendungan.'
  },
  {
    id: 2,
    question: 'Apa fungsi utama dari pipa pesat (penstock) dalam sistem PLTA?',
    options: [
      'Menyaring kotoran dan sampah dari dalam waduk agar tidak merusak mesin',
      'Mengalirkan air kembali ke atas waduk menggunakan pompa listrik',
      'Mengalirkan air dengan kemiringan curam untuk melipatgandakan kecepatan (energi kinetik) dan tekanan air',
      'Menghubungkan poros putaran turbin ke magnet rotor generator'
    ],
    correctIndex: 2,
    explanation: 'Pipa pesat merupakan saluran tertutup yang miring ke bawah, dirancang untuk mengarahkan air bertekanan besar dan berkecepatan tinggi agar langsung menumbuk sudu-sudu turbin.'
  },
  {
    id: 3,
    question: 'Bagaimana kontribusi transformator step-up pada penyaluran listrik PLTA?',
    options: [
      'Mengurangi debit air ketika beban grid menurun agar air waduk awet',
      'Mengubah arus listrik AC yang dihasilkan generator menjadi arus DC searah',
      'Menaikkan voltase listrik agar bisa dikirim ke tempat jauh dengan rugi daya (losses) minimal',
      'Menyetabilkan RPM putaran turbin agar tetap berada di frekuensi 50 Hz'
    ],
    correctIndex: 3,
    explanation: 'Transformator step-up bertugas mendongkrak tegangan keluaran generator menjadi ratusan kilovolt, sehingga kuat arus mengecil dan mengurangi rugi panas (I²R) saat dihantarkan lewat kabel SUTET.'
  },
  {
    id: 4,
    question: 'Prinsip kerja generator dalam menghasilkan muatan listrik didasarkan pada konsep...',
    options: [
      'Gaya Lorentz dan Hukum Ohm',
      'Induksi Elektromagnetik (Hukum Faraday)',
      'Gaya Apung dan Hukum Archimedes',
      'Termodinamika Aliran Fluida'
    ],
    correctIndex: 3,
    explanation: 'Hukum Faraday menyatakan bahwa perubahan medan magnet di dalam suatu kumparan kawat tembaga (stator) akibat rotor magnet yang berputar seporos dengan turbin akan menginduksi arus listrik.'
  },
  {
    id: 5,
    question: 'Jika slider debit air digeser ke kanan hingga penuh, apa yang akan terjadi pada sistem simulasi PLTA?',
    options: [
      'Katup intake menutup penuh, menghentikan seluruh pembangkitan listrik',
      'Meningkatkan laju air dan tekanan, membuat turbin-generator berputar lebih cepat, serta menaikkan daya (MW) listrik yang dihasilkan',
      'Generator akan mengalami kelebihan panas dan turbin terbakar mati secara otomatis',
      'Efisiensi turbin drop menjadi 0% karena debit terlalu berlebihan dari daya dukung waduk'
    ],
    correctIndex: 1,
    explanation: 'Debit air berbanding lurus dengan daya listrik yang dihasilkan. Debit air yang besar berarti volume air per detik meningkat, menghasilkan energi mekanis rotasi turbin generator yang lebih tinggi, sehingga daya listrik (MW) meningkat secara real-time.'
  }
];
