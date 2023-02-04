
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
      inventoryCount: 0,
      dealers: {},
      loading: false,
      filters: {
        radius: "25",
        zip: "55305",
        options: "",
        types: {},
        typesArray: [],
        sortOptions: ["Distance", "Price", "Odometer", "Year"],
        sortBy: "Price"
      },
      search: {
        pageIndex: 0,
        // resultIndex: 0,
        numberOfPages: 1,
        pageSize: 50,
        shouldFetchAll: true,
        facets: [],
        facetMap: {
          "BodyStyle": "Body Style",
          "Drivetrain": "Drivetrain",
          "ExteriorColor": "Exterior Color",
          "FuelType": "Fuel Type",
          "HighwayMpg": "Highway MPG",
          "InteriorColor": "Interior Color",
          "Model": "Model",
          "Odometer": "Odometer",
          "Option": "Package",
          "Price": "Price",
          "Series": "Series",
          "Transmission": "Transmission",
          "Type": "Type",
          "Upholstery": "Upholstery",
          "Year": "Year"
        }
      },
      formatter: new Intl.NumberFormat(),
      capMaxHeight: false
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
        // [
        //   {"name":"Series","values":["3 Series"]},
        //   {"name":"Year","values":["2019","2020","2021","2022"]},
        //   {"name": "Model", "values": ["330i xDrive", "330i"]}
        // ]
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
          // console.log(JSON.stringify(response, null, 4))
          // this.token = response.data.access_token
          // console.log(this.token)
          // this.inventory = response.data
          this.processInventory(response.data)
        })
    },
    processInventory(inventory) {
      this.allInventory = this.allInventory.concat(inventory.vehicles)
      inventory.dealers.forEach( dealer => {
        this.dealers[dealer.dealerCode] = dealer
      });
      if (this.search.pageIndex == 0) {
        let totalRecords = inventory.totalRecords
        console.log("Total records", totalRecords)
        // let resultRecords = inventory_json.resultRecords
        this.search.numberOfPages = Math.ceil(totalRecords / this.search.pageSize)
        if(this.search.numberOfPages > 30) {
          this.search.numberOfPages = 30
        }
        console.log("Number of pages", this.search.numberOfPages)
        // this.resultsIndex += this.pageSize
        // print("Recieved %d records for page %d" % (result_records, page_index + 1))
        this.search.pageIndex += 1
        this.setFilterTypes(inventory.facets)
        this.search.facets = inventory.facets
        if(this.filters.options.length == 0) {
          this.inventoryCount = totalRecords
        }
      }
    },
    fetchInventory() {
      this.loading = true;
      this.search.pageIndex = 0
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
          .then( () => {
            let promises = []
            let numberOfPages = this.search.numberOfPages
            if(this.search.shouldFetchAll && this.filters.options.length > 0 && !isNaN(numberOfPages) && numberOfPages > 1) {
              for(let i = 1; i < numberOfPages; i++) {
                promise = this.getInventory(i * this.search.pageSize)
                promises.push(promise)
              }
            } else {
              console.log("Only one page of results")
            }
            Promise.all(promises).then(() => {
              console.log("All results have been fetched")
              console.log("Retrieved", this.allInventory.length, "vehicles")
              this.filterAllInventory()
              this.loading = false;
            })
          });
      });
    },
    test() {
      this.filters.zip = 55115;
      this.filters.radius = 50;
      // this.filters.options = "5AU";
      // this.fetchInventory();
    },
    filterAllInventory() {
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
      facets.forEach(facet => {
        this.filters.types[facet.name] = []
        // facet.values.forEach(value =>{
        //   this.filters.types[facet.name].push(value.value)
        // })
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
      console.log(this.filters.typesArray)
    },
    facetName(facetType) {
      if(facetType in this.search.facetMap) {
        return this.search.facetMap[facetType]
      }
      return false
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

// window.onscroll = function() {myFunction()};
// var header = document.getElementById("header");
// var sticky = 100; // header.offsetTop;
// function myFunction() {
//   if (window.pageYOffset > sticky) {
//     app.capMaxHeight = true;
//   } else {
//     app.capMaxHeight = false;
//   }
// }
