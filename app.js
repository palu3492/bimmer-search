
const { createApp } = Vue

const app = createApp({
  data() {
    return {
      request: {
        imageUrl: atob("aHR0cHM6Ly9ibXcuYXNzZXRzLnNoaWZ0ZGlnaXRhbGludmVudG9yeS5jb20vaW1hZ2VzLw=="),
        carFaxUrl: atob("aHR0cHM6Ly93d3cuY2FyZmF4LmNvbS9WZWhpY2xlSGlzdG9yeS9wL1JlcG9ydC5jZng/cGFydG5lcj1TRFRfMCZ2aW49"),
        bmwUrl: atob("aHR0cHM6Ly93d3cuYm13dXNhLmNvbS9jZXJ0aWZpZWQtcHJlb3duZWQtc2VhcmNoLyMvZGV0YWlsLw=="),
        backendUrl: atob("aHR0cHM6Ly9iaW1tZXItc2VhcmNoLXNlcnZlci5wYWx1MzQ5Mi53b3JrZXJzLmRldi8="),
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
        radius: "25", // Use radius 0 for nationwide
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
        pages: [],
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
      formatter: new Intl.NumberFormat(),
      vehiclePhotoIndex: {}, // vin -> current photo index (cards)
      modalPhotoIndex: 0, // position in valid list for modal (separate from cards)
      selectedVehicle: null // vehicle shown in info modal
    }
  },
  methods: {
    getInventory(resultsIndex) {
      // Get a page of inventory results
      console.log("Results index", resultsIndex)
      // Set up the body of the request including all filters
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
        "Accept": "application/json"
      }
      let inventoryUrl = this.request.backendUrl + "vehicle"
      console.log("Fetching", inventoryUrl)
      return axios
        .post(inventoryUrl, payload, {
            headers: headers
        })
        .then(response => {
          // Once the response has been received, process the inventory results
          // However, nothing will be processed or updated on the UI until all pages of results are received
          this.processInventory(response.data)
          // If we are filtering by option codes and there are more than one page of results, then recursively grab the next page
          let numberOfPages = this.search.numberOfPages
          if(this.filteringByOption && !isNaN(numberOfPages) && numberOfPages > 1 && this.search.pageIndex < numberOfPages) {
            this.getInventory(this.search.pageIndex * this.search.pageSize)
          } else {
            console.log("All results have been fetched")
            console.log("Retrieved", this.inventory.all.length, "vehicles")
            // Now that all the results have been received we can process/filter everything
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
        // Update the user selctable avalible filters values with any new filter types
        this.updateFilters(inventory.facets)
        // Update the filters that are now avaliable, either more or less narrow
        this.updateFacets(inventory.facets)
        // When not filtering by option code, set the inventory length to the total number of results
        if(!this.filteringByOption) {
          this.inventory.count = totalRecords
        }
      }
      this.search.pageIndex += 1
    },
    fetchInventory() {
      // Fetches all the inventory results for either a paticular page or many pages when
      // filtering by option code
      this.setLoading(true);
      this.search.pageIndex = 0 // Reset back to zero
      this.vehiclePhotoIndex = {} // Reset photo index when user searches
      // If filtering by option code then fetch max page size
      if(this.filteringByOption) {
        this.search.pageSize = 100
      }
      // Clear out the inventory
      this.inventory.all = []
      // Set the array of filters to search on
      this.setFiltersToSerach()
      // Fetch inventory starting with first page
      // This call will recursively fetch all inventory results when filtering by option code
      this.getInventory(0)
    },
    changePage(page) {
      // console.log(page);
      this.search.pageIndex = page - 1;
      this.setLoading(true);
      this.inventory.all = []
      this.getInventory(this.search.pageIndex * this.search.pageSize)
    },
    filterAllInventory() {
      // Once all the inventory has been received from one or more pages, filter down the results is necessary
      this.search.pageSize = 25
      console.log("Filtering inventory")
      console.log("Options", this.filtering.options)
      // If filtering with option codes
      if(this.filteringByOption) {
        // Go through each vehicle and filter out the vehicles that don't have all the option codes
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
        // When filtering by option code, set the inventory length to number of filtered down results
        this.inventory.count = this.inventory.filtered.length
      } else {
        // When not filtering by option code, set the filtered inventory equal to the entire inventory
        this.inventory.filtered = this.inventory.all
      }
      console.log("Filtered down to", this.inventory.filtered.length, "vehicles")
      // Clear out previous dealers object and set to updated object
      this.dealers.current = {...this.dealers.new}
      this.dealers.new = {}
      this.setPages()
    },
    vehicleImage(vehicle) {
      if (!vehicle.photos || vehicle.photos.length === 0) return ""
      return this.request.imageUrl + vehicle.photos[0]
    },
    // Valid indices: 0, then 2..length-10 (skip 2nd photo and last 9)
    // The 2nd and last 8 photos are dealership photos
    validPhotoIndices(vehicle) {
      if (!vehicle.photos || vehicle.photos.length === 0) return []
      const L = vehicle.photos.length
      const valid = [0]
      for (let i = 2; i <= L - 10; i++) valid.push(i)
      return valid
    },
    getVehiclePhotoIndex(vehicle) {
      const valid = this.validPhotoIndices(vehicle)
      const pos = this.vehiclePhotoIndex[vehicle.vin] || 0
      return Math.min(Math.max(0, pos), Math.max(0, valid.length - 1))
    },
    getDisplayPhotoIndex(vehicle) {
      const valid = this.validPhotoIndices(vehicle)
      const pos = this.getVehiclePhotoIndex(vehicle)
      return valid[pos] ?? 0
    },
    setVehiclePhotoIndex(vehicle, index) {
      this.vehiclePhotoIndex[vehicle.vin] = index
    },
    prevPhoto(vehicle) {
      const i = this.getVehiclePhotoIndex(vehicle)
      if (i > 0) this.setVehiclePhotoIndex(vehicle, i - 1)
    },
    nextPhoto(vehicle) {
      const valid = this.validPhotoIndices(vehicle)
      const i = this.getVehiclePhotoIndex(vehicle)
      if (i < valid.length - 1) this.setVehiclePhotoIndex(vehicle, i + 1)
    },
    vehicleImageAt(vehicle, index) {
      if (!vehicle.photos || vehicle.photos[index] == null) return ""
      return this.request.imageUrl + vehicle.photos[index]
    },
    vehiclePackages(vehicle) {
      if (!vehicle.packageDescriptions || typeof vehicle.packageDescriptions !== 'string') return []
      return vehicle.packageDescriptions.split('|').map(s => s.trim()).filter(Boolean)
    },
    formatNumber(number) {
      // Adds commas where needed in numbers, i.e. 30000 = 30,000
      return this.formatter.format(number)
    },
    // resultsTooltip() {
    //   return 'Filtered ' + this.inventory.all.length + ' down to ' + this.inventory.filtered.length
    // },
    updateFilters(newFilters) {
      // Update the avaliable filters with the new filter received from the results
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
    setFiltersToSerach() {
      // Take all the set filters and create an array of those filters that can be
      // passed along with the inventory request to filter down results
      this.filtering.filtersToSearch = []
      for (const [key, value] of Object.entries(this.filtering.filters)) {
        if(value.length > 0) {
          const filterObject = {name: key, values: value} // Format each filter should be in
          this.filtering.filtersToSearch.push(filterObject)
        }
      }
      console.log("Filtered array", ...this.filtering.filtersToSearch)
    },
    facetName(facetName) {
      // Convert facet name to formatted name
      if(facetName in this.search.facetMap) {
        return this.search.facetMap[facetName]
      }
      return false
    },
    updateFacets(facets) {
      // Iterate over all avaliable facets filter out the ones we don't want to use or any with no values
      // Also, if any of the facets that we filtered on our now unavaliable, add them back in manually
      facetObjects = {}
      this.search.facetNames = []
      facets.forEach(facet => {
        // Don't show the facets we don't want and validate facet values
        if(this.search.facetOrder.indexOf(facet.name) >= 0 && (facet.values.length > 0 || this.filtering.filters[facet.name].length > 0)) {
          array = []
          facet.values.forEach(valueObject => {
            array.push(valueObject.value)
          })
          // Add back in any facets that we filtered on that are now gone
          if(facet.name in this.filtering.filters) {
            array = array.concat(this.filtering.filters[facet.name])
          }
          // Make facet values unqiue after we've merged our filters into the facet array
          facetObjects[facet.name] = [...new Set(array)].sort()
          // Update if facet should be shown
          facetObjects[facet.name].show = this.search.facets[facet.name]?.show
          // Array of facets that the UI renders based on
          this.search.facetNames.push(facet.name)
        }
      })
      // console.log([...this.search.facetNames])
      // Sort the list of facets by the order we've described
      this.search.facetNames.sort((a,b) => {
        return this.search.facetOrder.indexOf(a) > this.search.facetOrder.indexOf(b) ? 1 : -1
      })
      // console.log([...this.search.facetNames])
      // Finally, set the facets to updated object to render in the body of the facets on the UI
      this.search.facets = facetObjects
      this.search.facets["Type"] = ["CPO", "Used"] // Always have 'type' facet avaliable
    },
    setLoading(isLoading) {
      // While fetching the inventory results, show loading spinner
      this.loading = isLoading
    },
    setPages() {
      // [1,2,3,4,5],6,7,8,9
      // 1,2,[3,4,5,6,7],8,9
      // 1,2,3,4,[5,6,7,8,9]

      let numberOfPages = this.search.numberOfPages // 10
      let pageIndex = this.search.pageIndex // 9
      console.log("numberOfPages", numberOfPages);
      console.log("pageIndex", pageIndex);
      pages = []

      endDiff = numberOfPages - pageIndex
      endDiff = 2 - endDiff;
      if(endDiff < 0) {
        endDiff = 0;
      }

      // 2,3, 4, 5,6
      for(let i = pageIndex - 2 - endDiff; i <= numberOfPages; i++) {
        if(i > 0) {
          pages.push(i);
        }
        if(pages.length == 5) {
          break;
        }
      }
      console.log("Pages", [...pages])
      this.search.pages = pages;
    },
    openVehicleModal(vehicle) {
      this.selectedVehicle = vehicle;
      this.modalPhotoIndex = this.getVehiclePhotoIndex(vehicle);
      document.body.style.overflow = 'hidden';
    },
    closeVehicleModal() {
      this.selectedVehicle = null;
      document.body.style.overflow = '';
    },
    getModalDisplayPhotoIndex() {
      if (!this.selectedVehicle) return 0;
      const valid = this.validPhotoIndices(this.selectedVehicle);
      const pos = Math.min(Math.max(0, this.modalPhotoIndex), Math.max(0, valid.length - 1));
      return valid[pos] ?? 0;
    },
    prevModalPhoto() {
      if (this.modalPhotoIndex > 0) this.modalPhotoIndex--;
    },
    nextModalPhoto() {
      if (!this.selectedVehicle) return;
      const valid = this.validPhotoIndices(this.selectedVehicle);
      if (this.modalPhotoIndex < valid.length - 1) this.modalPhotoIndex++;
    },
    test() {
      this.filtering.zip = 55115;
      this.filtering.radius = 50;
      // this.filtering.options = "5AU";
      // this.fetchInventory();
    }
  },
  computed: {
    showAdditionalPage() {
      return this.search.pages[this.search.pages.length - 1] != this.search.numberOfPages
    },
    filteringByOption() {
      return this.filtering.options.length > 0;
    }
  },
  watch: {
    // allInventory(oldInventory, newInventory) {
      
    // }
  },
  mounted() {
    this.fetchInventory()
  }
}).mount("#app")

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

