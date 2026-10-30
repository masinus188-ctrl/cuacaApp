const WeatherTable = {
  props: {
    rows: { type: Array, required: true },
    selectedDay: { type: String, required: true },
    minimumDate: { type: String, required: true },
    maximumDate: { type: String, required: true },
  },

  setup(props, { emit }) {
    const hoveredPoint = Vue.ref(null)
    const formatSuhu = (n) => n.toFixed(1).replace('.', ',') + ' °C'
    function showTemperature(event) {
      const bounds = event.currentTarget.getBoundingClientRect()
      const chartX = ((event.clientX - bounds.left) / bounds.width) * 760
      const points = chartData.value.pointsArr
      if (points.length) hoveredPoint.value = points.reduce((nearest, point) =>
        Math.abs(point.x - chartX) < Math.abs(nearest.x - chartX) ? point : nearest)
    }
    const hideTemperature = () => { hoveredPoint.value = null }
    function shiftSelectedDay(offset) {
      const date = new Date(`${props.selectedDay}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      const nextDate = date.toISOString().slice(0, 10)
      if (nextDate < props.minimumDate || nextDate > props.maximumDate) return
      hoveredPoint.value = null
      emit('select-day', nextDate)
    }

    const canGoPrevious = Vue.computed(() => props.selectedDay > props.minimumDate)
    const canGoNext = Vue.computed(() => props.selectedDay < props.maximumDate)

    const chartData = Vue.computed(() => {
      const data = props.rows
      if (!data.length) return { line: '', area: '', labels: [], extremes: [], pointsArr: [], min: 0, max: 0 }
      const width = 760, height = 220, left = 24, right = 12, top = 18, bottom = 22
      const tempMin = Math.min(...data.map((r) => r.temp))
      const tempMax = Math.max(...data.map((r) => r.temp))
      const spread = Math.max(tempMax - tempMin, 1)
      const points = data.map((row, i) => ({
        ...row,
        x: left + (i / Math.max(data.length - 1, 1)) * (width - left - right),
        y: top + (1 - (row.temp - tempMin) / spread) * (height - top - bottom),
      }))
      const line = points.reduce((path, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`
        const prev = points[index - 1], before = points[index - 2] || prev, next = points[index + 1] || point
        return `${path} C ${prev.x + (point.x - before.x) / 6} ${prev.y + (point.y - before.y) / 6}, ${point.x - (next.x - prev.x) / 6} ${point.y - (next.y - prev.y) / 6}, ${point.x} ${point.y}`
      }, '')
      const area = `${line} L ${points[points.length - 1].x} ${height - bottom} L ${points[0].x} ${height - bottom} Z`
      const labels = data.filter((_, i) => i % Math.max(Math.ceil(data.length / 6), 1) === 0 || i === data.length - 1).map((row) => row.jam)
      const minIndex = data.findIndex((row) => row.temp === tempMin)
      const maxIndex = data.findIndex((row) => row.temp === tempMax)
      const extremes = [
        { ...points[minIndex], kind: 'Terendah', color: '#3885c7' },
        ...(maxIndex === minIndex ? [] : [{ ...points[maxIndex], kind: 'Tertinggi', color: '#e65353' }]),
      ].map((point) => ({ ...point, labelX: Math.max(100, Math.min(width - 100, point.x)), labelY: Math.max(14, point.y - 13) }))
      return { line, area, labels, extremes, pointsArr: points, min: tempMin, max: tempMax }
    })

    return {
      formatSuhu, chartData, hoveredPoint, showTemperature, hideTemperature,
      shiftSelectedDay, canGoPrevious, canGoNext,
    }
  },

  template: `
    <div class="chart-card" v-if="rows.length">
        <div class="chart-header">
          <div>
            <div class="eyebrow">Perubahan suhu</div>
            <h3>{{ rows[0].label }}</h3>
          </div>
          <div class="chart-summary">
            <span class="chart-range-label">Rentang suhu</span>
            <strong>{{ formatSuhu(chartData.min) }} <span>—</span> {{ formatSuhu(chartData.max) }}</strong>
          </div>
        </div>

        <div class="chart-wrap" @pointermove="showTemperature" @pointerleave="hideTemperature">
          <svg viewBox="0 0 760 220" preserveAspectRatio="none" role="img" :aria-label="'Grafik suhu pada ' + rows[0].label">
            <defs>
              <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#78b8a5" stop-opacity="0.2"></stop>
                <stop offset="100%" stop-color="#80b8d2" stop-opacity="0.04"></stop>
              </linearGradient>
            </defs>

            <g class="chart-grid">
              <line x1="24" x2="748" y1="40" y2="40"></line>
              <line x1="24" x2="748" y1="100" y2="100"></line>
              <line x1="24" x2="748" y1="160" y2="160"></line>
            </g>

            <path :d="chartData.area" fill="url(#chartFill)" opacity="1"></path>
            <path :d="chartData.line" fill="none" stroke="#829ba3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>

            <circle
              v-for="point in chartData.extremes"
              :key="point.kind"
              :cx="point.x"
              :cy="point.y"
              r="5"
              :fill="point.color"
              stroke="#fff"
              stroke-width="2.5"
            ></circle>
            <line
              v-if="hoveredPoint"
              :x1="hoveredPoint.x"
              :x2="hoveredPoint.x"
              y1="18"
              y2="198"
              stroke="#6b8792"
              stroke-width="1"
              stroke-dasharray="3 4"
              opacity="0.7"
            ></line>
            <circle
              v-if="hoveredPoint"
              :cx="hoveredPoint.x"
              :cy="hoveredPoint.y"
              r="5"
              fill="#52717e"
              stroke="#fff"
              stroke-width="2"
            ></circle>
            <text
              v-for="point in chartData.extremes"
              :key="point.kind + '-label'"
              :x="point.labelX"
              :y="point.labelY"
              text-anchor="middle"
              :fill="point.color"
              class="chart-extreme-label"
            >{{ point.kind }} {{ formatSuhu(point.temp) }} · {{ point.jam }}</text>
          </svg>
          <div
            v-if="hoveredPoint"
            class="chart-tooltip"
            :style="{
              left: Math.max(12, Math.min(88, hoveredPoint.x / 760 * 100)) + '%',
              top: Math.max(62, hoveredPoint.y / 220 * 100) + '%'
            }"
            role="status"
          >
            <strong>{{ hoveredPoint.jam }}</strong>
            <span>{{ formatSuhu(hoveredPoint.temp) }}</span>
          </div>
        </div>

        <div class="chart-labels" v-if="chartData.labels.length">
          <span v-for="(label, index) in chartData.labels" :key="index">{{ label }}</span>
        </div>

        <nav class="chart-navigation" aria-label="Navigasi tanggal grafik">
          <button
            type="button"
            class="chart-nav-button"
            :disabled="!canGoPrevious"
            @click="shiftSelectedDay(-1)"
          ><span aria-hidden="true">«««</span> Kemarin</button>
          <button
            type="button"
            class="chart-nav-button"
            :disabled="!canGoNext"
            @click="shiftSelectedDay(1)"
          >Besok <span aria-hidden="true">»»»</span></button>
        </nav>
    </div>
  `,
}
