
const { createApp } = Vue

const app = createApp({
  data() {
    return {
      request: {
        url: atob("aHR0cHM6Ly9pbnZlbnRvcnlzZXJ2aWNlcy5ibXdkZWFsZXJwcm9ncmFtcy5jb20v"),
        imageUrl: atob("aHR0cHM6Ly9ibXctaW52ZW50b3J5LWFzc2V0cy1wcm9kLmF6dXJlZWRnZS5uZXQvaW1hZ2VzLw=="),
        carFaxUrl: atob("aHR0cHM6Ly93d3cuY2FyZmF4LmNvbS9WZWhpY2xlSGlzdG9yeS9wL1JlcG9ydC5jZng/cGFydG5lcj1TRFRfMCZ2aW49"),
        bmwUrl: atob("aHR0cHM6Ly93d3cuYm13dXNhLmNvbS9jZXJ0aWZpZWQtcHJlb3duZWQtc2VhcmNoLyMvZGV0YWlsLw=="),
        token: ""
      },
      inventory: {
        filtered: [],
        all: [],
        count: null
      },
      dealers: {
        current: {},
        new: {}
      },
      loading: false,
      filtering: {
        radius: "25",
        zip: "55305",
        options: "",
        filters: {}, // Filters to show user and holds the enabled/disabled value of each filter
        filtersToSearch: [], // List of user set filters to send with the inventory request
        sortOptions: ["Distance", "Price", "Odometer", "Year"],
        sortBy: "Price",
        show: screen.width > 768 // Default hide filters on mobile
      },
      search: {
        pageIndex: 0,
        numberOfPages: 1,
        pageSize: 25,
        facets: {},
        facetNames: [],
        facetMap: {
          "Odometer": "Odometer",
          "Price": "Price",
          "Year": "Year",
          "Series": "Series",
          "Model": "Model",
          "Option": "Package",
          "ExteriorColor": "Exterior Color",
          "InteriorColor": "Interior Color",
          "Upholstery": "Upholstery",
          "Drivetrain": "Drivetrain",
          "Transmission": "Transmission",
          "BodyStyle": "Body Style",
          "FuelType": "Fuel Type"
        },
        facetOrder: ["Odometer", "Price", "Year", "Series", "Model", "Option", "ExteriorColor", "InteriorColor", "Upholstery", "Drivetrain", "Transmission", "BodyStyle", "FuelType"]
      },
      formatter: new Intl.NumberFormat()
    }
  },
  methods: {
    getToken() {
      let tokenUrl = this.request.url + "token"
      let username = atob("Qk1XSW52ZW50b3J5QGNyaXRpY2FsbWFzcy5jb20=")
      let password = atob("MW52M250MHJ5ITIwMjA=")
      let payload = {
        "grant_type": "password",
        "username": username,
        "password": password
      }
      let headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      }
      console.log("Fetching", tokenUrl)
      return axios
        .post(tokenUrl, payload, {
          headers: headers
        })
        .then(response => {
          // console.log(JSON.stringify(response, null, 4))
          this.request.token = response.data.access_token
          console.log(this.token)
        })
    },
    getInventory(resultsIndex) {
      console.log("Results index", resultsIndex)
      if(this.request.token.length < 10) {
        console.log("No token")
        return Promise.resolve()
      }
      // Use radius 0 for nationwide
      let auth = "Bearer " + this.request.token
      let payload = {
        "pageIndex": resultsIndex,
        "PageSize": this.search.pageSize,
        "postalCode": this.filtering.zip,
        "radius": this.filtering.radius,
        "sortBy": this.filtering.sortBy,
        "sortDirection": "asc",
        "formatResponse": false,
        "includeFacets": true,
        "includeDealers": true,
        "includeVehicles": true,
        "filters": this.filtering.filtersToSearch
      }
      let headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": auth
      }
      let url = URL + "vehicle"
      let inventoryUrl = this.request.url + "vehicle"
      console.log("Fetching", inventoryUrl)
      return axios
        .post(inventoryUrl, payload, {
            headers: headers
        })
        .then(response => {
          this.processInventory(response.data)

          let numberOfPages = this.search.numberOfPages
          if(this.filtering.options.length > 0 && !isNaN(numberOfPages) && numberOfPages > 1 && this.search.pageIndex < numberOfPages) {
            this.getInventory(this.search.pageIndex * this.search.pageSize)
          } else {
            console.log("All results have been fetched")
            console.log("Retrieved", this.inventory.all.length, "vehicles")
            this.filterAllInventory()
            this.setLoading(false);
          }
        })
    },
    processInventory(inventory) {
      // Save all inventory results before filtering
      this.inventory.all = this.inventory.all.concat(inventory.vehicles)
      // Store dealer information so vehicles can reference their associated dealer
      inventory.dealers.forEach( dealer => {
        // Each vehicle includes a dealer code
        this.dealers.new[dealer.dealerCode] = dealer
      });
      // If this is the first inventory request then clear out all the old
      // set variables and intialize them so they can be populated with the
      // latest incoming data from one or more inventory responses
      if (this.search.pageIndex == 0) {
        let totalRecords = inventory.totalRecords
        console.log("Total records", totalRecords)
        // Calculate the number of pages required to fetch all inventory for the set filters
        this.search.numberOfPages = Math.ceil(totalRecords / this.search.pageSize)
        // If filters are too broad and require more than 20 pages of results then cap
        // the number of pages to 20
        if(this.search.numberOfPages > 20) {
          this.search.numberOfPages = 20
        }
        console.log("Number of pages", this.search.numberOfPages)
        // print("Recieved %d records for page %d" % (result_records, page_index + 1))
        // Update the avalible filters, they will become more or less narrow based on
        this.updateFilters(inventory.facets)
        this.setFacets(inventory.facets)
        if(this.filtering.options.length == 0) {
          this.inventory.count = totalRecords
        }
      }
      this.search.pageIndex += 1
    },
    fetchInventory() {
      this.setLoading(true);
      this.search.pageIndex = 0
      if(this.filtering.options.length > 0) {
        this.search.pageSize = 100
      }
      this.inventory.all = []
      this.setFilterArray()
      let promise = NaN
      if(this.request.token.length < 10) {
        console.log("Grabbing token")
        promise = this.getToken()
      } else {
        promise = Promise.resolve()
      }
      promise.then(() => {
        this.getInventory(0)
      });
    },
    test() {
      this.filtering.zip = 55115;
      this.filtering.radius = 50;
      // this.filtering.options = "5AU";
      // this.fetchInventory();
    },
    filterAllInventory() {
      this.search.pageSize = 25
      console.log("Filtering inventory")
      console.log("Options", this.filtering.options)
      if(this.filtering.options.length > 0) {
        let options = this.filtering.options.split(", ")
        this.inventory.filtered = this.inventory.all.filter(vehicle => {
          include = true;
          options.forEach(option => {
            if(!vehicle.allCodes || !vehicle.allCodes.includes(option)) {
              include = false
            }
          })
          return include
        })
        this.inventory.count = this.inventory.filtered.length
      } else {
        this.inventory.filtered = this.inventory.all
      }
      console.log("Filtered down to", this.inventory.filtered.length, "vehicles")
      this.dealers.current = {...this.dealers.new}
      this.dealers.new = {}
    },
    vehicleImage(vehicle) {
      if(!vehicle.photos || vehicle.photos.length == 0) {
        return ""
      }
      return this.request.imageUrl + vehicle.photos[0]
    },
    formatNumber(number) {
      return this.formatter.format(number)
    },
    resultsTooltip() {
      return 'Filtered ' + this.inventory.all.length + ' down to ' + this.inventory.filtered.length
    },
    updateFilters(newFilters) {
      const currentFilters = {...this.filtering.filters}
      // this.filtering.filters = {}
      newFilters.forEach(filter => {
        if(filter.name in currentFilters) {
          // this.filtering.filters[facet.name] = currentFilters[facet.name]
        } else {
          this.filtering.filters[filter.name] = []
        }
      })
      // console.log(this.filtering.filters)
    },
    setFilterArray() {
      this.filtering.filtersToSearch = []
      for (const [key, value] of Object.entries(this.filtering.filtersToSearch)) {
        if(value.length > 0) {
          const filterObject = {name: key, values: value}
          this.filtering.filtersToSearch.push(filterObject)
        }
      }
      console.log("Filter array", ...this.filtering.filtersToSearch)
    },
    facetName(facetName) {
      if(facetName in this.search.facetMap) {
        return this.search.facetMap[facetName]
      }
      return false
    },
    setFacets(facets) {
      facetObjects = {}
      this.search.facetNames = []
      facets.forEach(facet => {
        if(this.search.facetOrder.indexOf(facet.name) >= 0 && (facet.values.length > 0 || this.filtering.filtersToSearch[facet.name].length > 0)) {
          array = []
          facet.values.forEach(valueObject => {
            array.push(valueObject.value)
          })
          if(facet.name in this.filtering.filtersToSearch) {
            array = array.concat(this.filtering.filtersToSearch[facet.name])
          }
          facetObjects[facet.name] = [...new Set(array)]
          this.search.facetNames.push(facet.name)
        }
      })
      // console.log([...this.search.facetNames])
      this.search.facetNames.sort((a,b) => {
        return this.search.facetOrder.indexOf(a) > this.search.facetOrder.indexOf(b) ? 1 : -1
      })
      // console.log([...this.search.facetNames])
      this.search.facets = facetObjects
      this.search.facets["Type"] = ["CPO", "Used"]
    },
    setLoading(isLoading) {
      // While fetching the inventory results, show loading spinner
      this.loading = isLoading
    }
  },
  watch: {
    // allInventory(oldInventory, newInventory) {
      
    // }
  },
  mounted() {
    // Run this when app starts
    // ============================
    // First get the token to be used for fetching inventory
    //  - If this fails, we'll grab the token during the inventory fetching
    // Then fetch first page of inventory with default filters
    this.getToken()
      .then( () => {
        this.fetchInventory()
        // this.test()
      })
  }
}).mount("#app")

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

