Module.register("MMM-evcc-SolarYield", {
  defaults: {
    api_url: "http://192.168.178.28:7070/api/tariff/solar",
    updateInterval: 10 * 60 * 1000,
    height: 300,
    width: 500,
    lineColor: "rgb(255, 230, 0)",
    fillColor: "rgba(255, 249, 215, 0)",
    tension: 0.4,
    chartType: "line", // Can be "line" or "bar"
    label: "Solar Yield (kWh)",
    xAxisLabel: "Time",
    horizontalLines: [{ value: 5, label: "Sunny day" }, { value: 2, label: "Cloudy winter day" }],
  },

  getScripts: function() {
    return [
      "https://cdn.jsdelivr.net/npm/chart.js@3.7.0/dist/chart.min.js",
      "https://cdn.jsdelivr.net/npm/moment@2.29.1/moment.min.js",
      "https://cdn.jsdelivr.net/npm/chartjs-adapter-moment@1.0.0/dist/chartjs-adapter-moment.min.js",
      "https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@2.2.1"
    ];
  },

  getStyles: function() {
    return ["MMM-evcc-SolarYield.css"];
  },

  start: function() {
    this.solarData = null;
    this.chart = null;
    this.loaded = false;
    this.canvasId = `solarChart-${this.identifier}`;
    Log.info(`Starting module: ${this.name}`);
    
    // Ensure Chart.js is using moment adapter and register annotation plugin
    if (typeof Chart !== 'undefined' && typeof moment !== 'undefined') {
      Log.info("Chart and moment are loaded, adapter should be ready");
    }
    if (typeof Chart !== 'undefined' && typeof ChartAnnotation !== 'undefined') {
      Chart.register(ChartAnnotation);
      Log.info("Chart.js annotation plugin registered");
    }
  },

  getDom: function() {
    const wrapper = document.createElement("div");
    wrapper.className = "solar-graph";
    
    this.canvas = document.createElement("canvas");
    this.canvas.id = this.canvasId;
    this.canvas.width = this.config.width;
    this.canvas.height = this.config.height;
    wrapper.appendChild(this.canvas);
    
    this.loadingText = document.createElement("div");
    this.loadingText.innerHTML = "Loading solar data...";
    this.loadingText.className = "loading-text";
    wrapper.appendChild(this.loadingText);
    
    return wrapper;
  },

  notificationReceived: function(notification) {
    if (notification === "DOM_OBJECTS_CREATED" && !this.loaded) {
      this.scheduleUpdate();
      this.loaded = true;
    }
  },

  scheduleUpdate: function() {
    this.fetchData();
    const self = this;
    setInterval(() => {
      self.fetchData();
    }, this.config.updateInterval);
  },

  fetchData: function() {
    const self = this;
    if (!document.getElementById(this.canvasId)) {
      Log.info("Canvas not available yet, skipping update");
      return;
    }
    fetch(this.config.api_url)
      .then(response => response.json())
      .then(data => {
        self.solarData = data;
        self.updateGraph();
      })
      .catch(error => {
        Log.error("SolarYield module fetch error:", error);
        self.updateError("Failed to load solar data");
      });
  },

  updateGraph: function() {
    if (this.loadingText) {
      this.loadingText.remove();
      this.loadingText = null;
    }
    if (!this.solarData || !this.solarData.result || !this.solarData.result.rates) {
      Log.info("No data available for graph update");
      return;
    }
    const canvas = document.getElementById(this.canvasId);
    if (!canvas) {
      Log.info("Canvas element not found");
      return;
    }
    const rates = this.solarData.result.rates;
    const now = new Date();
    // Set start time to today at 00:00
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    // Set end time to 48 hours after start time
    const endTime = new Date(startTime.getTime() + 48 * 60 * 60 * 1000);
    const hourlyData = {};

    for (const rate of rates) {
      const rateTime = new Date(rate.start);
      // Filter data between startTime and endTime
      if (rateTime >= startTime && rateTime < endTime) {
      const hourStart = new Date(rateTime.getFullYear(), rateTime.getMonth(), rateTime.getDate(), rateTime.getHours());
      const key = hourStart.getTime();
      if (!hourlyData[key]) {
        hourlyData[key] = 0;
      }
      hourlyData[key] += rate.value;
      }
    }

    const dataPoints = Object.keys(hourlyData)
      .map(key => ({
      x: new Date(parseInt(key)),
      y: (hourlyData[key] / 1000).toFixed(2)
      }))
      .sort((a, b) => a.x - b.x);
    const annotations = [
      {
        type: 'line',
        mode: 'vertical',
        scaleID: 'x',
        value: now,
        borderColor: 'red',
        borderWidth: 2,
        label: {
          enabled: true,
          content: 'Now',
          position: 'top'
        }
      }
    ];


    
    if (this.config.horizontalLines) {
      this.config.horizontalLines.forEach(line => {
        annotations.push({
          type: 'line',
          mode: 'horizontal',
          scaleID: 'y',
          value: line.value,
          borderColor: 'rgb(255, 238, 0)',
          borderWidth: 1,
          label: {
            enabled: true,
            content: line.label,
            position: 'right'
          }
        });
      });
    }

    if (this.chart) {
      this.chart.data.datasets[0].data = dataPoints;
      this.chart.options.scales.x.min = startTime;
      this.chart.options.scales.x.max = now;
      this.chart.options.plugins.annotation.annotations = annotations;
      this.chart.update();
    } else {
      const dataset = {
        label: this.config.label,
        data: dataPoints,
        backgroundColor: this.config.fillColor,
        borderColor: this.config.lineColor,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: "#fff",
        pointBorderColor: this.config.lineColor,
        tension: this.config.tension,
        fill: this.config.chartType === "line" ? "origin" : false
      };

      if (this.config.chartType === "bar") {
        dataset.borderWidth = 1;
        dataset.borderRadius = 3;
        dataset.backgroundColor = this.config.lineColor;
      }

      const options = {
        responsive: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              displayFormats: {
                hour: 'MMM D HH:mm'
              }
            },
            min: startTime,
            max: endTime,
            title: {
              display: true,
              text: this.config.xAxisLabel,
              color: "#fff"
            },
            ticks: {
              color: "#fff"
            }
          },
          y: {
            title: {
              display: true,
              text: "kWh",
              color: "#fff"
            },
            beginAtZero: true,
            ticks: {
              color: "#fff"
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: "#fff",
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.parsed.y} kWh`
            }
          },
          annotation: {
            annotations: annotations 
          }
        }
      };

      this.chart = new Chart(canvas.getContext("2d"), {
        type: this.config.chartType,
        data: {
          datasets: [dataset]
        },
        options: options
      });
    }
  },

  updateError: function(message) {
    if (this.loadingText) {
      this.loadingText.innerHTML = message;
      this.loadingText.style.color = "#ff5555";
    }
  }
});