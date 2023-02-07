
const { createApp } = Vue

const app = createApp({
  data() {
    return {
      message: 'Only a test',
      info: null,
      url: atob("aHR0cHM6Ly9pbnZlbnRvcnlzZXJ2aWNlcy5ibXdkZWFsZXJwcm9ncmFtcy5jb20v"),
      imageUrl: atob("aHR0cHM6Ly9ibXctaW52ZW50b3J5LWFzc2V0cy1wcm9kLmF6dXJlZWRnZS5uZXQvaW1hZ2VzLw=="),
      carFaxUrl: atob("aHR0cHM6Ly93d3cuY2FyZmF4LmNvbS9WZWhpY2xlSGlzdG9yeS9wL1JlcG9ydC5jZng/cGFydG5lcj1TRFRfMCZ2aW49"),
      bmwUrl: atob("aHR0cHM6Ly93d3cuYm13dXNhLmNvbS9jZXJ0aWZpZWQtcHJlb3duZWQtc2VhcmNoLyMvZGV0YWlsLw=="),
      token: "",
      filteredInventory: [],
      allInventory: [],
      inventoryCount: null,
      dealers: {},
      updatedDealers: {},
      loading: false,
      filters: {
        radius: "25",
        zip: "55305",
        options: "",
        types: {},
        typesArray: [],
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
      let tokenUrl = this.url + "token"
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
          this.token = response.data.access_token
          console.log(this.token)
        })
    },
    getInventory(resultsIndex) {
      console.log("Results index", resultsIndex)
      if(this.token.length < 10) {
        console.log("No token")
        return Promise.resolve()
      }
      // Use radius 0 for nationwide
      let auth = "Bearer " + this.token
      let payload = {
        "pageIndex": resultsIndex,
        "PageSize": this.search.pageSize,
        "postalCode": this.filters.zip,
        "radius": this.filters.radius,
        "sortBy": this.filters.sortBy,
        "sortDirection": "asc",
        "formatResponse": false,
        "includeFacets": true,
        "includeDealers": true,
        "includeVehicles": true,
        "filters": this.filters.typesArray
      }
      let headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": auth
      }
      let url = URL + "vehicle"
      let inventoryUrl = this.url + "vehicle"
      console.log("Fetching", inventoryUrl)
      return axios
        .post(inventoryUrl, payload, {
            headers: headers
        })
        .then(response => {
          this.processInventory(response.data)

          let numberOfPages = this.search.numberOfPages
          if(this.filters.options.length > 0 && !isNaN(numberOfPages) && numberOfPages > 1 && this.search.pageIndex < numberOfPages) {
            this.getInventory(this.search.pageIndex * this.search.pageSize)
          } else {
            console.log("All results have been fetched")
            console.log("Retrieved", this.allInventory.length, "vehicles")
            this.filterAllInventory()
            this.loading = false;
          }
        })
    },
    processInventory(inventory) {
      this.allInventory = this.allInventory.concat(inventory.vehicles)
      inventory.dealers.forEach( dealer => {
        this.updatedDealers[dealer.dealerCode] = dealer
      });
      if (this.search.pageIndex == 0) {
        let totalRecords = inventory.totalRecords
        console.log("Total records", totalRecords)
        // let resultRecords = inventory_json.resultRecords
        this.search.numberOfPages = Math.ceil(totalRecords / this.search.pageSize)
        if(this.search.numberOfPages > 20) {
          this.search.numberOfPages = 20
        }
        console.log("Number of pages", this.search.numberOfPages)
        // this.resultsIndex += this.pageSize
        // print("Recieved %d records for page %d" % (result_records, page_index + 1))
        this.setFilterTypes(inventory.facets)
        this.setFacets(inventory.facets)
        if(this.filters.options.length == 0) {
          this.inventoryCount = totalRecords
        }
      }
      this.search.pageIndex += 1
    },
    fetchInventory() {
      this.loading = true;
      this.search.pageIndex = 0
      if(this.filters.options.length > 0) {
        this.search.pageSize = 100
      }
      this.allInventory = []
      this.setFilterArray()
      let promise = NaN
      if(this.token.length < 10) {
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
      this.filters.zip = 55115;
      this.filters.radius = 50;
      // this.filters.options = "5AU";
      // this.fetchInventory();
    },
    filterAllInventory() {
      this.search.pageSize = 25
      console.log("Filtering inventory")
      console.log("Options", this.filters.options)
      if(this.filters.options.length > 0) {
        let options = this.filters.options.split(", ")
        this.filteredInventory = this.allInventory.filter(vehicle => {
          include = true;
          options.forEach(option => {
            if(!vehicle.allCodes || !vehicle.allCodes.includes(option)) {
              include = false
            }
          })
          return include
        })
        this.inventoryCount = this.filteredInventory.length
      } else {
        this.filteredInventory = this.allInventory
      }
      console.log("Filtered down to", this.filteredInventory.length, "vehicles")
      this.dealers = {...this.updatedDealers}
      this.updatedDealers = {}
    },
    vehicleImage(vehicle) {
      if(!vehicle.photos || vehicle.photos.length == 0) {
        return ""
      }
      return this.imageUrl + vehicle.photos[0]
    },
    formatNumber(number) {
      return this.formatter.format(number)
    },
    resultsTooltip() {
      return 'Filtered ' + this.allInventory.length + ' down to ' + this.filteredInventory.length
    },
    setFilterTypes(facets) {
      const filterTypes = {...this.filters.types}
      // this.filters.types = {}
      facets.forEach(facet => {
        if(facet.name in filterTypes) {
          // this.filters.types[facet.name] = filterTypes[facet.name]
        } else {
          this.filters.types[facet.name] = []
        }
      })
      // console.log(this.filters.types)
    },
    setFilterArray() {
      this.filters.typesArray = []
      for (const [key, value] of Object.entries(this.filters.types)) {
        if(value.length > 0) {
          const filterObject = {name: key, values: value}
          this.filters.typesArray.push(filterObject)
        }
      }
      console.log("Filter array", ...this.filters.typesArray)
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
        if(this.search.facetOrder.indexOf(facet.name) >= 0 && (facet.values.length > 0 || this.filters.types[facet.name].length > 0)) {
          array = []
          facet.values.forEach(valueObject => {
            array.push(valueObject.value)
          })
          array = array.concat(this.filters.types[facet.name])
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
    }
  },
  watch: {
    // allInventory(oldInventory, newInventory) {
      
    // }
  },
  mounted() {
    // this.getToken()
    // this.test()

    this.getToken()
      .then( () => {
        this.fetchInventory()
      })
  }
}).mount("#app")

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

