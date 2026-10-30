const { createApp, ref, computed, watch, onMounted } = Vue

// Saya tambahkan 3 kota lainnya, Pangkalan Bun, Semarang, Palangkaraya
const KOTA = [
  { id: 'jakarta', name: 'Jakarta', lat: -6.2, lon: 106.8 },
  { id: 'pangkalan-bun', name: 'Pangkalan Bun', lat: -2.68, lon: 111.62 },
  { id: 'semarang', name: 'Semarang', lat: -6.97, lon: 110.42 },
  { id: 'palangkaraya', name: 'Palangkaraya', lat: -2.21, lon: 113.92 },
]

// Membuat variabel hari & bulan 
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function shiftDate(date, offset) {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + offset)
  return shifted.toISOString().slice(0, 10)
}

function todayWIB() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`
}

// Memanggil API, saya modifikasi API agar dapat mengambil >1 kota
function buildUrl(kota, startDate, endDate, archive = false) {
  const endpoint = archive
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast'
  return (
    `${endpoint}?latitude=${kota.lat}&longitude=${kota.lon}` +
    `&hourly=temperature_2m&timezone=Asia%2FJakarta&start_date=${startDate}&end_date=${endDate}`
  )
}

function parseTime(iso) {
  const [date, jam] = iso.split('T')
  const [year, month, day] = date.split('-').map(Number)
  const namaHari = HARI[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return { date, jam, label: `${namaHari}, ${day} ${BULAN[month - 1]} ${year}` }
}

function formatSuhu(n) {
  return n.toFixed(1).replace('.', ',') + ' °C'
}

createApp({
  components: { WeatherTable },

  template: `
    <div class="app-shell">
      <header class="topbar">
        <div class="title-wrap">
          <h1>Prakiraan Suhu</h1>
          <p class="subtitle">Suhu udara per jam di {{ kota.name }} (2 m di atas tanah)</p>
        </div>
      </header>

      <div class="toolbar">
        <div class="field">
          <label for="kota">Lokasi</label>
          <div class="select-wrap">
            <select id="kota" v-model="selectedCity">
              <option v-for="city in KOTA" :key="city.id" :value="city.id">{{ city.name }}</option>
            </select>
          </div>
        </div>

        <div class="field date-field">
          <label for="anchor-date">Pilih Tanggal</label>
          <input
            id="anchor-date"
            type="date"
            v-model="selectedDate"
            :min="minimumDate"
            :max="maximumDate"
          />
        </div>

        <button type="button" :disabled="loading" @click="loadData">Muat ulang</button>
      </div>

      <p v-if="loading" class="status">Memuat data....</p>
      <p v-else-if="error" class="status error">
        Data gagal dimuat. Periksa koneksi internet lalu tekan “Refresh Halaman”.<br>
        <small>{{ error }}</small>
      </p>
      <weather-table
        v-else-if="stats && visibleRows.length"
        :rows="visibleRows"
        :selected-day="selectedDay"
        :minimum-date="minimumDate"
        :maximum-date="maximumDate"
        @select-day="selectDate"
      ></weather-table>

      <p class="status">WIB</p>
    </div>
  `,

  setup() {
    const data = ref([])
    const loading = ref(true)
    const error = ref('')
    const selectedCity = ref('jakarta')
    const selectedDate = ref(todayWIB())

    const kota = computed(() => KOTA.find((city) => city.id === selectedCity.value))
    const minimumDate = '1940-01-03'
    const maximumDate = computed(() => shiftDate(todayWIB(), 9))
    const selectedDay = computed(() => selectedDate.value)

    let requestId = 0

    async function loadData() {
      const id = ++requestId
      loading.value = true
      error.value = ''
      try {
        const startDate = shiftDate(selectedDate.value, -2)
        const endDate = shiftDate(selectedDate.value, 7)
        const today = todayWIB()
        const requests = []

        if (startDate < today) {
          const archiveEnd = endDate < today ? endDate : shiftDate(today, -1)
          requests.push(fetch(buildUrl(kota.value, startDate, archiveEnd, true)))
        }

        if (endDate >= today) {
          const forecastStart = startDate > today ? startDate : today
          requests.push(fetch(buildUrl(kota.value, forecastStart, endDate)))
        }

        const responses = await Promise.all(requests)
        const jsonResults = await Promise.all(responses.map(async (response) => {
          if (!response.ok) throw new Error('Server mengembalikan status ' + response.status)
          return response.json()
        }))
        if (id !== requestId) return

        data.value = jsonResults.flatMap((json) => {
          const { time, temperature_2m } = json.hourly
          return time
            .map((timestamp, index) => ({ time: timestamp, temp: temperature_2m[index], ...parseTime(timestamp) }))
            .filter((row) => row.temp !== null)
        })
      } catch (e) {
        if (id !== requestId) return
        error.value = e.message
        data.value = []
      } finally {
        if (id === requestId) loading.value = false
      }
    }

    onMounted(loadData)
    watch(selectedCity, () => {
      if (selectedDate.value === todayWIB()) loadData()
      else selectedDate.value = todayWIB()
    })
    watch(selectedDate, (date) => {
      if (date && date >= minimumDate && date <= maximumDate.value) loadData()
    })

    function selectDate(date) {
      if (date >= minimumDate && date <= maximumDate.value) selectedDate.value = date
    }

    const visibleRows = computed(() => data.value.filter((row) => row.date === selectedDate.value))
    const stats = computed(() => {
      const temperatures = data.value.map((row) => row.temp)
      if (!temperatures.length) return null
      return {
        min: Math.min(...temperatures),
        max: Math.max(...temperatures),
        avg: temperatures.reduce((sum, temperature) => sum + temperature, 0) / temperatures.length,
      }
    })

    return {
      KOTA, kota, selectedCity, loading, error, selectedDate, selectedDay, visibleRows, stats,
      minimumDate, maximumDate, loadData, selectDate,
    }
  },
}).mount('#app')
