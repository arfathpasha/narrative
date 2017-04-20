/**
 * A DynamicTable widget.
 * This is a very very lightweight table that uses a callback to set its data based on user actions.
 * Make it like this:
 *
 * var targetDiv = '<div>';
 * var myTable = new DynamicTable(targetDiv, {
 *   headers: [{
 *       id: 'col1',
 *       text: 'First Col',
 *       isSortable: false,
 *   }, {
 *       id: 'col2',
 *       text: 'Second Col',
 *       isSortable: true
 *   }],
 *   decoration: [{
 *       col: 'col1',
 *       type: 'link',
 *       clickFunction: function(text) { do stuff with text }
 *   }],
 *   updateFunction: function(pageNum, query, sortColId, sortColDir) {
 *       return {
 *           rows: [['row1,col1', 'row1,col2'],
 *                  ['row2,col1', 'row2,col2']],
 *           start: 0,
 *           total: 1000,
 *           query: ''
 *       }
 *   }
 *   rowsPerPage: 10,
 *   searchPlaceholder: 'Search for data',
 *   class: 'css classes to apply to outer container',
 *   style: 'css style to apply to outer container'
 */
define([
    'jquery',
    'bootstrap',
    'bluebird',
    'kbase-generic-client-api',
    'narrativeConfig'
], function(
    $,
    Bootstrap,
    Promise,
    GenericClient,
    Config
) {

    var DynamicTable = function (elem, options) {
        this.options = {
            class: '',
            style: {},
            searchPlaceholder: 'Search',
            rowsPerPage: 10,
            headers: [],
            decoration: [],
            data: []
        };
        $.extend(true, this.options, options);

        this.currentSort = {
            id: null,
            dir: null
        };
        this.currentPage = 0;
        this.sortCol = null;
        this.sortDir = null;
        this.rowsPerPage = this.options.rowsPerPage;
        this.total = 0;
        this.start = 0;
        this.end = 0;

        this.headers = this.options.headers;
        this.decoration = this.options.decoration;

        this.initialize(elem);
        this.getNewData();
    };

    /**
     * Initialize the whole shebang with the given options.
     * Starts with creating a container for all the elements to live in,
     * then builds the header, table, and footer.
     * This doesn't actually set the data or anything, it just inits the various
     * DOM elements and events.
     */
    DynamicTable.prototype.initialize = function(elem) {
        this.$container = $('<div>').addClass('container-fluid ' + this.options.class);
        this.$container.css(this.options.style);

        this.$container.append(this.makeWidgetHeader());

        this.$table = $('<table id="dynamic_table" class="table table-striped table-bordered table-hover">');
        this.$tHeader = $('<tr>');
        this.headers.forEach(function (h) {
            this.$tHeader.append(this.makeTableHeader(h));
        }.bind(this));
        this.$table.append($('<thead>').append(this.$tHeader));
        this.$tBody = $('<tbody>');
        this.$table.append(this.$tBody);

        this.$container
            .append($('<div class="row">').append($('<div class="col-md-12">').append(this.$table)))
            .append(this.makeWidgetFooter());
        $(elem).append(this.$container);
    };

    /**
     * Builds the footer for the whole widget, sits below the table.
     * Just shows what rows are visible right now.
     */
    DynamicTable.prototype.makeWidgetFooter = function() {
        this.$shownText = $('<span></span>');
        var $footer = $('<div class="row">')
                      .append($('<div class="col-md-12">')
                              .append(this.$shownText));
        return $footer;
    };

    /**
     * Makes the header for the whole table widget.
     * This includes L/R buttons for table pagination, a hideable spinner for loading,
     * and a search element.
     */
    DynamicTable.prototype.makeWidgetHeader = function() {
        var self = this;
        var $leftBtn = simpleButton('btn-md', 'fa fa-caret-left')
                       .click(function() {
                           var curP = self.currentPage;
                           if (self.getPrevPage() !== curP) {
                               self.getNewData();
                           }
                       });
        var $rightBtn = simpleButton('btn-md', 'fa fa-caret-right')
                        .click(function() {
                            var curP = self.currentPage;
                            if (self.getNextPage() !== curP) {
                                self.getNewData();
                            }
                        });
        var $pageBtns = $('<div class="col-md-4">')
                        .append($leftBtn)
                        .append($rightBtn);

        self.$loadingElement = $('<div>')
                               .attr('align', 'center')
                               .append($('<i>').addClass('fa fa-spinner fa-spin fa-2x'))
                               .hide();
        var $loadingDiv = $('<div class="col-md-4">').append(self.$loadingElement);

        var $searchElement = $('<input>')
                             .attr('type', 'text')
                             .addClass('form-control')
                             .attr('placeholder', self.options.searchPlaceholder)
                             .on('keyup', function() {
                                 self.currentQuery = $.trim($searchElement.val());
                                 self.currentPage = 0;
                                 self.getNewData();
                             });
        var $searchDiv = $('<div class="col-md-4 pull-right">').append($searchElement);

        return $('<div class="row" style="margin-bottom: 5px">')
                .append($pageBtns)
                .append($loadingDiv)
                .append($searchDiv);
    };

    /**
     * Updates the current page to the previous one, as long as it's >= 0.
     */
    DynamicTable.prototype.getPrevPage = function() {
        this.currentPage--;
        if (this.currentPage < 0) {
            this.currentPage = 0;
        }
        return this.currentPage;
    };

    /**
     * Updates the current page to the next one, if available.
     * If not, nothing changes.
     */
    DynamicTable.prototype.getNextPage = function() {
        this.currentPage++;
        if (this.currentPage * this.rowsPerPage >= this.total) {
            this.currentPage--;
        }
        return this.currentPage;
    };

    /**
     * This fetches a new set of data, by firing the updateFunction
     * with the current table state, including page, etc.
     */
    DynamicTable.prototype.getNewData = function() {
        this.$loadingElement.show();
        this.options.updateFunction(this.currentPage,
                                    this.currentQuery,
                                    this.currentSort.id,
                                    this.currentSort.sortState)
            .then(function(data) {
                this.update(data);
            }.bind(this))
            .catch(function(error) {
                alert('error!');
                console.error(error);
            })
            .finally(function() {
                this.$loadingElement.hide();
            }.bind(this));
    };

    /**
     * Build the header row for the table.
     * This makes each th element bold (with the given header.text value), and adds a sort
     * button if necessary.
     */
    DynamicTable.prototype.makeTableHeader = function(header) {
        var $header = $('<th>').append($('<b>').append(header.text));
        header.sortState = 0;
        if (header.isSortable) {
            // add sorting.
            var $sortBtn = simpleButton('btn-xs', 'fa fa-sort text-muted').addClass('pull-right');
            $sortBtn.click(function() {
                // reset all other sort buttons
                var curState = header.sortState;
                this.headers.forEach(function(h) {
                    h.sortState = 0;
                });
                // set this one to sort. if up, then down, if down then up, if neither then up
                if (curState < 1) {
                    header.sortState = 1;
                }
                else {
                    header.sortState = -1;
                }
                this.currentSort = header;
                this.getNewData();
            }.bind(this));
            $header.append($sortBtn);
        }
        $header.resizable({
            handles: 'e'
        });
        return $header;
    };

    /*
     * Sets the actual data into the table.
     * This empties out the current table body, and replaces the contents with the values in data.
     * Data is expected to be a list of lists.
     * If this DynamicTable was initialized with a decoration on each column, those columns have
     * their decoration applied to them as well, and linked to the clickFunction.
     */
    DynamicTable.prototype.setData = function(data) {
        // list of lists. Empty it out, then put it in place in the given order.
        this.$tBody.empty();
        data.forEach(function(row) {
            // decorate each row element as necessary
            this.options.decoration.forEach(function(dec) {
                if (dec.type == 'link') {
                    row[dec.col] = '<a style="cursor:pointer">' + row[dec.col] + '</a>';
                }
                else if (dec.type == 'button') {
                    row[dec.col] = '<button class="btn btn-default btn-sm">' + row[dec.col] + '</button>';
                }
            });
            // build the table row elem
            var $newRow = tableRow(row);
            // add click bindings to decorated elements
            this.options.decoration.forEach(function(dec) {
                if (dec.clickFunction) {
                    var $clickElem = $newRow.find('td:eq(' + dec.col + ') > :eq(0)');
                    $clickElem.click(function() {
                        dec.clickFunction($clickElem.text());
                    });
                }
            });
            this.$tBody.append($newRow);
        }.bind(this));
    };

    /**
     * Updates the table based on the given data.
     * Data should have the following keys:
     * rows = list of lists, contains the actual data
     * start = int, the index of the first value, compared to the total available data
     * total = int, the total available rows (not just in this view)
     */
    DynamicTable.prototype.update = function(data) {
        // update header sort buttons
        this.headers.forEach(function(h, idx) {
            if (h.isSortable) {
                var newClass = 'fa-sort text-muted';
                if (h.sortState == 1) {
                    newClass = 'fa-sort-up';
                }
                if (h.sortState == -1) {
                    newClass = 'fa-sort-down';
                }
                this.$tHeader
                    .find('th:eq(' + idx + ') .fa')
                    .removeClass('fa-sort fa-sort-down fa-sort-up text-muted')
                    .addClass(newClass);
            }
        }.bind(this));
        // update data
        this.setData(data.rows);
        this.start = data.start;
        this.end = data.start + data.rows.length;
        this.total = data.total;
        this.$shownText.text('Showing ' + (this.start+1) + ' to ' + this.end + ' of ' + this.total);
        //  + ' on page ' + this.currentPage);
    };

    /**
     * Converts an array to a table row.
     * e.g., if the array is ['abc', '123']
     * this returns:
     * <tr>
     *     <td>abc</td>
     *     <td>123</td>
     * </tr>
     */
    var tableRow = function(data) {
        var elem = 'td';
        return $('<tr>').append(
            data.map(function(d) {
                return '<' + elem + '>' + d + '</' + elem + '>';
            }).join()
        );
    };

    /**
     * A helper function that makes a simple button with an icon in it.
     * sizeClass is expected to be a bootstrap btn size (btn-xs, btn-md, etc)
     * iconClass is expected to be a space-delimited string ('fa fa-spinner fa-spin fa-2x', etc.)
     */
    var simpleButton = function(sizeClass, iconClass) {
        return $('<button>')
               .addClass('btn btn-default ' + sizeClass)
               .append($('<span>').addClass(iconClass));
    };



    return DynamicTable;
});
