/*global define,require*/
/*jslint white: true*/
// leave at least 2 line with only a star on it below, or doc generation fails
/**
 *
 *
 * Placeholder for custom user javascript
 * mainly to be overridden in profile/static/custom/custom.js
 * This will always be an empty file in Jupyter
 *
 * User could add any javascript in the `profile/static/custom/custom.js` file.
 * It will be executed by the Jupyter notebook at load time.
 *
 * Same thing with `profile/static/custom/custom.css` to inject custom css into the notebook.
 *
 *
 * The object available at load time depend on the version of Jupyter in use.
 * there is no guaranties of API stability.
 *
 * The example below explain the principle, and might not be valid.
 *
 * Instances are created after the loading of this file and might need to be accessed using events:
 *     define (
 [
 'kbwidget',
 'bootstrap',
 '*        base/js/namespace',
 '*        base/js/events
 *'
 ], function(
 KBWidget,
 bootstrap,
 Jupyter,
 events
 ) {
 *         events.on("app_initialized.NotebookApp", function () {
 *             Jupyter.keyboard_manager....
 *         });
 *     });
 *
 * __Example 1:__
 *
 * Create a custom button in toolbar that execute `%qtconsole` in kernel
 * and hence open a qtconsole attached to the same kernel as the current notebook
 *
 *    define([
 *        'base/js/namespace',
 *        'base/js/events'
 *    ], function(Jupyter, events) {
 *        events.on('app_initialized.NotebookApp', function(){
 *            Jupyter.toolbar.add_buttons_group([
 *                {
 *                    'label'   : 'run qtconsole',
 *                    'icon'    : 'icon-terminal', // select your icon from http://fortawesome.github.io/Font-Awesome/icons
 *                    'callback': function () {
 *                        Jupyter.notebook.kernel.execute('%qtconsole')
 *                    }
 *                }
 *                // add more button here if needed.
 *                ]);
 *        });
 *    });
 *
 * __Example 2:__
 *
 * At the completion of the dashboard loading, load an unofficial javascript extension
 * that is installed in profile/static/custom/
 *
 *    define([
 *        'base/js/events'
 *    ], function(events) {
 *        events.on('app_initialized.DashboardApp', function(){
 *            require(['custom/unofficial_extension.js'])
 *        });
 *    });
 *
 * __Example 3:__
 *
 *  Use `jQuery.getScript(url [, success(script, textStatus, jqXHR)] );`
 *  to load custom script into the notebook.
 *
 *    // to load the metadata ui extension example.
 *    $.getScript('/static/notebook/js/celltoolbarpresets/example.js');
 *    // or
 *    // to load the metadata ui extension to control slideshow mode / reveal js for nbconvert
 *    $.getScript('/static/notebook/js/celltoolbarpresets/slideshow.js');
 *
 *
 * @module Jupyter
 * @namespace Jupyter
 * @class customjs
 * @static
 */
define([
    'jquery',
    'base/js/namespace',
    'base/js/security',
    'base/js/utils',
    'base/js/page',
    'notebook/js/codecell',
    'notebook/js/notebook',
    'notebook/js/textcell',
    'notebook/js/savewidget',
    'notebook/js/celltoolbar',
    'base/js/dialog',
    'base/js/keyboard',
    'notebook/js/keyboardmanager',
    'notebook/js/cell',
    'common/utils',
    'kb_common/html',
    'narrativeConfig',

    'components/requirejs/require',
    'narrative_paths'
], function (
    $,
    Jupyter,
    security,
    nbUtils,
    page,
    codeCell,
    notebook,
    textCell,
    saveWidget,
    cellToolbar,
    dialog,
    keyboard,
    keyboardManager,
    cell,
    utils,
    html,
    narrativeConfig
    ) {
    'use strict';

    var t = html.tag,
        span = t('span'), div = t('div');

    // GLOBAL EVENTS AND OVERRIDES

    // inject necessary environment vars into the kernel as soon as it's ready.
    $([Jupyter.events]).on('kernel_ready.Kernel', function () {
        Jupyter.notebook.kernel.execute(
            'import os;' +
            'os.environ["KB_AUTH_TOKEN"]="' + Jupyter.narrative.authToken + '";' +
            'os.environ["KB_WORKSPACE_ID"]="' + Jupyter.notebook.metadata.ws_name + '"'
            );
    }
    );

    // Kickstart the Narrative loading routine once the notebook is loaded.
    $([Jupyter.events]).on('app_initialized.NotebookApp', function () {
        require(['kbaseNarrative'], function (Narrative) {

            Jupyter.narrative = new Narrative();
            Jupyter.narrative.init();

            /*
             * Override the move-cursor-down-or-next-cell and
             * move-cursor-up-or-previous-cell actions.
             *
             * When editing a textcell (markdown or code), if a user uses
             * the arrow keys to move to another cell, it normally lands
             * there in edit mode.
             *
             * This is bad for KBase-ified markdown cells, since it shows
             * the div and script tags that are used to render them, and
             * screws up the state management. These overrides just
             * check if the next cell is a KBase cell, and doesn't enable
             * edit mode if so.
             */
            Jupyter.keyboard_manager.actions.register({
                handler: function (env, event) {
                    var index = env.notebook.get_selected_index();
                    var cell = env.notebook.get_cell(index);
                    if (cell.at_bottom() && index !== (env.notebook.ncells() - 1)) {
                        if (event) {
                            event.preventDefault();
                        }
                        env.notebook.command_mode();
                        env.notebook.select_next(true);
                        if (!env.notebook.get_selected_cell().metadata['kb-cell']) {
                            env.notebook.edit_mode();
                            var cm = env.notebook.get_selected_cell().code_mirror;
                            cm.setCursor(0, 0);
                        }
                    }
                    return false;
                }
            },
                'move-cursor-down',
                'jupyter-notebook');

            Jupyter.keyboard_manager.actions.register({
                handler: function (env, event) {
                    var index = env.notebook.get_selected_index(),
                        cell = env.notebook.get_cell(index),
                        cm = env.notebook.get_selected_cell().code_mirror,
                        cur = cm.getCursor();
                    if (cell && cell.at_top() && index !== 0 && cur.ch === 0) {
                        if (event) {
                            event.preventDefault();
                        }
                        env.notebook.command_mode();
                        env.notebook.select_prev(true);
                        if (!env.notebook.get_selected_cell().metadata['kb-cell']) {
                            env.notebook.edit_mode();
                            cm = env.notebook.get_selected_cell().code_mirror;
                            cm.setCursor(cm.lastLine(), 0);
                        }
                    }
                    return false;
                }
            },
                'move-cursor-up',
                'jupyter-notebook');
        });
    });

    /*
     * We override this method because jupyter uses .height() rather than
     * css('height'). In the former just the internal height is returned,
     * although later versions of jquery (should be the one we are using,
     * but it didn't appear to be so) should have fixed this behavior when
     * box-sizing: border-box is used. I tried that, but it didn't seem to
     * work. Using css('height'), however, works.
     * This bug was manifested in a permanent scrollbar for the main content
     * area, since its size was set too tall.
     */
    page.Page.prototype._resize_site = function () {
        // Update the site's size.
        $('div#site').height($(window).height() - $('#header').css('height'));
    };


    // Patch the security mechanisms to allow any JavaScript to run for now.
    // TODO: update this so only the few KBase commands run.
    security.sanitize_html = function (html, allow_css) {
        return html;
    };
    security.sanitize_css = function (css, tagPolicy) {
        return css;
    };
    security.sanitize_stylesheets = function (html, tagPolicy) {
        return html;
    };

    // TODO: refactor
    function cellType(cell) {
        // Cells are (currently) rendered twice. The first time the kb metadata
        // is not available, but we can rely on future renders.
        if (cell.renderCount > 1) {
            return;
        }

        var type = cell.metadata &&
            cell.metadata['kb-cell'] &&
            cell.metadata['kb-cell']['type'];

        // Markdown cells don't of course have a kb cell type.
        if (type === undefined) {
            return;
        }

        switch (type) {
            case 'function_input':
                return 'method';
            case 'kb_app':
                return 'app';
            case 'function_output':
                return 'output';
            default:
                return 'unknown';
        }

    }

    // CELLTOOLBAR

//        cellToolbar.CellToolbar.prototype.renderToggleState = function () {
//            var toggleState = this.cell.getCellState('toggleState', 'unknown');
//            // Test to see if the kbaseNarrativeCellMenu is attached to this toolbar.
//            //
//            //var elemData = $(this.inner_element).find('.button_container').data();
//            //if (elemData && elemData['kbaseNarrativeCellMenu'])
//            //   $(this.inner_element).find('.button_container').kbaseNarrativeCellMenu('toggleState', toggleState);
//            //
//            // TODO: rewire the rendering of togglestate to just go through the
//            // natural cell toolbar refresh which occurs when the cell metadata
//            // is updated (cell.metadata = {what:'ever'};).
//        };

    // disable hiding of the toolbar
    cellToolbar.CellToolbar.prototype.hide = function () {
        return;
    };

    // CELL

    (function () {
        var p = cell.Cell.prototype;

        // This is how we extend methods.
        (function () {
            var originalMethod = p.select;
            p.select = function () {
                var wasSelected = originalMethod.apply(this);
                if (wasSelected) {
                    $(this.element).trigger('selected.cell');
                }
                return wasSelected;
            };
        }());

        // Extend
        (function () {
            var originalMethod = cell.Cell.prototype.unselect;
            cell.Cell.prototype.unselect = function (leave_selected) {
                var wasSelected = originalMethod.apply(this, [leave_selected]);
                $(this.element).trigger('unselected.cell');
                return wasSelected;
            };
        }());

        p.renderMinMax = function () {
            var $cellNode = $(this.element),
                metaToggleMode = utils.getCellMeta(this, 'kbase.cellState.toggleMinMax'),
                toggleMode = $cellNode.data('toggleMinMax');

            if (metaToggleMode) {
                if (!toggleMode) {
                    // The first time an existing cell is rendered after loading a
                    // notebook, the node data for toggleMinMax
                    // will be empty, so we need to initialize it. This is an auto-initialize.
                    toggleMode = metaToggleMode;
                    $cellNode.data('toggleMinMax', toggleMode);
                }
            } else if (!toggleMode) {
                // If there is neither a data attribute on the node nor a metadata
                // property, then this is a new cell, and it will be maximized.
                toggleMode = 'maximized';
                $cellNode.data('toggleMinMax', toggleMode);
            }

            switch (toggleMode) {
                case 'maximized':
                    if (!this.maximize) {
                        console.log('HELP', this);
                    }
                    this.maximize();
                    break;
                case 'minimized':
                    this.minimize();
                    break;
            }
        };

        p.toggleMinMax = function () {
            var $cellNode = $(this.element),
                toggleMode = $cellNode.data('toggleMinMax') || 'maximized';

            switch (toggleMode) {
                case 'maximized':
                    toggleMode = 'minimized';
                    break;
                case 'minimized':
                    toggleMode = 'maximized';
                    break;
            }

            // NB namespacing is important with jquery messages because they
            // propagate through nodes like DOM messages (i.e. the toolbar, being
            // contained within the cell, propagates the event upwards, after
            // which it continues to the cell (and perhaps beyond). So using
            // the same event name will lead to an infinite loop.
            // this.celltoolbar.element.trigger('toggleMinMax.toolbar');

            $cellNode.data('toggleMinMax', toggleMode);

            this.renderMinMax();

            utils.setCellMeta(this, 'kbase.cellState.toggleMinMax', toggleMode, true);
        };

        (function () {
            var originalMethod = p.bind_events;
            p.bind_events = function () {
                var $el = $(this.element);
                originalMethod.apply(this);

                //                $el.on('toggle.cell', function () {
                //                    // Alas, it has no discriminating attributes!
                //                    thisCell.toggle();
                //                });
                //                $el.on('rendered.cell', function () {
                //                    thisCell.renderToggleState();
                //                    $(thisCell.element).trigger('set-title.cell', thisCell.getCellState('title'));
                //                });

                // Universal invocation of cell min max
                $el.on('toggleMinMax.cell', function () {
                    this.toggleMinMax();
                }.bind(this));

                this.events.on('preset_activated.CellToolbar', function (e, data) {
                    if (data.name === 'KBase') {
                        this.renderMinMax();
                    }
                }.bind(this));
            };
        }());

    }());


    // RAW CELL

     (function () {
        var p = textCell.RawCell.prototype;

        p.minimize = function () {
            var $cellNode = $(this.element);
            $cellNode.find('.inner_cell > div:nth-child(2)').addClass('hidden');
            $cellNode.find('.inner_cell > div:nth-child(3)').addClass('hidden');
            utils.setCellMeta(this, 'kbase.cellState.showTitle', true);
        };

        p.maximize = function () {
            var $cellNode = $(this.element);
            $cellNode.find('.inner_cell > div:nth-child(2)').removeClass('hidden');
            $cellNode.find('.inner_cell > div:nth-child(3)').removeClass('hidden');
            utils.setCellMeta(this, 'kbase.cellState.showTitle', false);
        };

        // We need this method because the layout of each type of cell and
        // interactions with min/max can be complex.
        p.renderPrompt = function () {
            var prompt = this.element[0].querySelector('.input_prompt');
            if (!prompt) {
                return;
            }
            prompt.innerHTML = '';
        };

        /** @method bind_events **/
        p.bind_events = function () {
            textCell.TextCell.prototype.bind_events.apply(this);

            var cell = this,
                $cellNode = $(this.element);

            this.element.dblclick(function () {
                var cont = cell.unrender();
                if (cont) {
                    cell.focus_editor();
                }
            });

            /*
             * This is the trick to get the markdown to render, and the edit area
             * to disappear, when the user clicks out of the edit area.
             */
            this.code_mirror.on('blur', function () {
                cell.render();
            });


            /*
             * The cell toolbar buttons area knows how to set the title and
             * icon for itself. But we store the title and icon here in case
             * the celltoolbar is not fully built yet. In that case, it will
             * look at the containing cell to see if it has been set yet, and if
             * so will use that (of course listening for these events too.)
             */
            $cellNode.on('set-title.cell', function (e, title) {
                if (title === undefined) {
                    return;
                }
                // cell.setCellState('title', title);
                utils.setCellMeta(cell, 'kbase.cellState.title', title);
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('set-title.toolbar', [title || '']);
                if (cellType(cell) !== undefined) {
                    $(cell.element).trigger('show-title.cell');
                }
            });

            $cellNode.on('hide-title.cell', function (e) {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('hide-title.toolbar');
            });

            $cellNode.on('show-title.cell', function (e) {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('show-title.toolbar');
            });

            $cellNode.on('set-icon.cell', function (e, icon) {
                // cell.setCellState('icon', icon);
                utils.setCellMeta(cell, 'kbase.cellState.icon', icon);
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('set-icon.toolbar', [icon]);
            });

            /*
             * This is how the cell propagates the select/unselect events to
             * the child "widget" -- the celltoolbar in this case.
             * But, of course, it is a hack.
             * - we should be able to add it as a behavior on the cell prototype
             * - we should be able to propagate it to the celltoolbar itself, we
             *   are talking to the button area, because that is what we are able
             *   to control inside the celltoolbar
             */
            // this.events
            $cellNode.on('unselected.cell', function () {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                // cell.setCellState('selected', false);
                utils.setCellMeta(cell, 'kbase.cellState.selected', false);
                $menu.trigger('unselected.toolbar');
            });

            // this.events
            $cellNode.on('selected.cell', function () {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                utils.setCellMeta(cell, 'kbase.cellState.selected', true);
                // cell.setCellState('selected', true);
                $menu.trigger('selected.toolbar');
            });

            // Note - this event needs to be subscribed to in each cell interested.
            // This is really the kick-off for the narrative, since the
            // presets on the celltoobar are loaded via event calls,
            // so are not part of the synchronous process
            // which builds the UI.
            this.events.on('preset_activated.CellToolbar', function (e, data) {
                if (data.name === 'KBase') {
                    // ensure the icon is set?
                    utils.setCellMeta(this, 'kbase.attributes.icon', 'font');
                    // Set up the toolbar based on the state.
                    // TODO: refactor in general -- reconcile cellState and attributes

                    //$cellNode.trigger('set-title.cell', [cell.getCellState('title', '')]);
                    //$cellNode.trigger('set-icon.cell', [cell.getCellState('icon', '')]);

                    // DISABLED: toggling
                    // TODO: re-enable!
                    // cell.renderToggleState();
                }
            }.bind(this));
        };
    }());



    // MARKDOWN CELL

    (function () {
        var p = textCell.MarkdownCell.prototype;

        p.minimize = function () {
            var $cellNode = $(this.element);
            $cellNode.find('.inner_cell > div:nth-child(2)').addClass('hidden');
            $cellNode.find('.inner_cell > div:nth-child(3)').addClass('hidden');
            utils.setCellMeta(this, 'kbase.cellState.showTitle', true);
        };

        p.maximize = function () {
            var $cellNode = $(this.element);
            $cellNode.find('.inner_cell > div:nth-child(2)').removeClass('hidden');
            $cellNode.find('.inner_cell > div:nth-child(3)').removeClass('hidden');
            utils.setCellMeta(this, 'kbase.cellState.showTitle', false);
        };

        // We need this method because the layout of each type of cell and
        // interactions with min/max can be complex.
        p.renderPrompt = function () {
            var prompt = this.element[0].querySelector('.input_prompt');
            if (!prompt) {
                return;
            }
            prompt.innerHTML = '';

//            var prompt = this.element[0].querySelector('.input_prompt'),
//                iconType = utils.getCellMeta(this, 'kbase.attributes.icon', 'file-o'),
//                icon = span({
//                    class: 'fa fa-' + iconType + ' fa-2x'
//                });
//
//            if (!prompt) {
//                return;
//            }
//
//            prompt.innerHTML = div({
//                style: {textAlign: 'center'}
//            }, [
//                icon
//            ]);
        };

        p.getIcon = function () {
            var iconColor = 'silver';

            return span({style: ''}, [
                span({class: 'fa-stack fa-2x', style: {textAlign: 'center', color: iconColor}}, [
                    span({class: 'fa fa-square fa-stack-2x', style: {color: iconColor}}),
                    span({class: 'fa fa-inverse fa-stack-1x fa-' + 'paragraph'})
                ])
            ]);
        };



        /** @method bind_events **/
        p.bind_events = function () {
            textCell.TextCell.prototype.bind_events.apply(this);

            var cell = this,
                $cellNode = $(this.element);

            this.element.dblclick(function () {
                var cont = cell.unrender();
                if (cont) {
                    cell.focus_editor();
                }
            });

            /*
             * This is the trick to get the markdown to render, and the edit area
             * to disappear, when the user clicks out of the edit area.
             */
            this.code_mirror.on('blur', function () {
                cell.render();
            });


            /*
             * The cell toolbar buttons area knows how to set the title and
             * icon for itself. But we store the title and icon here in case
             * the celltoolbar is not fully built yet. In that case, it will
             * look at the containing cell to see if it has been set yet, and if
             * so will use that (of course listening for these events too.)
             */
            $cellNode.on('set-title.cell', function (e, title) {
                if (title === undefined) {
                    return;
                }
                // cell.setCellState('title', title);
                utils.setCellMeta(cell, 'kbase.cellState.title', title);
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('set-title.toolbar', [title || '']);
                if (cellType(cell) !== undefined) {
                    $(cell.element).trigger('show-title.cell');
                }
            });

            $cellNode.on('hide-title.cell', function (e) {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('hide-title.toolbar');
            });

            $cellNode.on('show-title.cell', function (e) {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('show-title.toolbar');
            });

            $cellNode.on('set-icon.cell', function (e, icon) {
                // cell.setCellState('icon', icon);
                utils.setCellMeta(cell, 'kbase.cellState.icon', icon);
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('set-icon.toolbar', [icon]);
            });

            $cellNode.on('job-state.cell', function (e, data) {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                $menu.trigger('job-state.toolbar', data);
            });


            /*
             * This is how the cell propagates the select/unselect events to
             * the child "widget" -- the celltoolbar in this case.
             * But, of course, it is a hack.
             * - we should be able to add it as a behavior on the cell prototype
             * - we should be able to propagate it to the celltoolbar itself, we
             *   are talking to the button area, because that is what we are able
             *   to control inside the celltoolbar
             */
            // this.events
            $cellNode.on('unselected.cell', function () {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                // cell.setCellState('selected', false);
                utils.setCellMeta(cell, 'kbase.cellState.selected', false);
                $menu.trigger('unselected.toolbar');
            });

            // this.events
            $cellNode.on('selected.cell', function () {
                var $menu = $(cell.celltoolbar.element).find('.button_container');
                utils.setCellMeta(cell, 'kbase.cellState.selected', true);
                // cell.setCellState('selected', true);
                $menu.trigger('selected.toolbar');
            });

            this.events.on('rendered.MarkdownCell', function (e, data) {
                // cell.setCellState('icon', 'paragraph');
                utils.setCellMeta(cell, 'kbase.attributes.icon', 'paragraph');

                // DISABLED toggleing
                // TODO: re-enable!
                // cell.renderToggleState();

                // get the h1 if it exists.
                var title,
                    renderedContent = cell.element.find('.rendered_html'),
                    h1 = renderedContent.find('h1');
                if (h1.length > 0) {
                    title = h1[0].innerText;
                } else {
                    title = renderedContent[0].textContent;
                }

                if (title) {
                    // trim down to max 50 characters
                    if (title.length > 50) {
                        title = title.substr(0, 50) + '...';
                    }
                    // trim down to the 'paragraph' char - signifies the end of a header element
                    var paraIdx = title.indexOf('¶');
                    if (paraIdx !== -1) {
                        title = title.substr(0, paraIdx);
                    }
                    // trim down to the end of the first newline - a linebreak should be a title
                    var newLineIdx = title.indexOf('\n');
                    if (newLineIdx !== -1) {
                        title = title.substr(0, newLineIdx);
                    }
                } else {
                    title = '<i>empty markdown cell - add a title with # </i>';
                }

                // if (title) {
                // cell.setCellState('title', title);
                utils.setCellMeta(cell, 'kbase.attributes.title', title, true);

                // this.renderPrompt();

                // Extract title from h1, if any. otheriwse, first 50 characters
                //var title = $html.filter('h1').first().first().text();
                //if (!title && $html.first().html()) {
                //    title = $html.first().html().substr(0, 50) || '';
                //}

                // $(cell.element).trigger('set-title.cell', cell.getCellState('title'));
                //$(cell.element).trigger('set-icon.cell', ['<i class="fa fa-2x fa-paragraph markdown-icon"></i>']);
            }.bind(this));

            // Note - this event needs to be subscribed to in each cell interested.
            // This is really the kick-off for the narrative, since the
            // presets on the celltoobar are loaded via event calls,
            // so are not part of the synchronous process
            // which builds the UI.
            this.events.on('preset_activated.CellToolbar', function (e, data) {
                if (data.name === 'KBase') {
                    // ensure the icon is set?
                    utils.setCellMeta(this, 'kbase.attributes.icon', 'paragraph');
                    // Set up the toolbar based on the state.
                    // TODO: refactor in general -- reconcile cellState and attributes

                    //$cellNode.trigger('set-title.cell', [cell.getCellState('title', '')]);
                    //$cellNode.trigger('set-icon.cell', [cell.getCellState('icon', '')]);

                    // DISABLED: toggling
                    // TODO: re-enable!
                    // cell.renderToggleState();
                }
            }.bind(this));
        };
    }());

    // Patch the MarkdownCell renderer to run the Javascript we need.
    textCell.MarkdownCell.options_default = {
        cm_config: {
            mode: 'ipythongfm'
        },
        placeholder: "_Markdown_/LaTeX cell - double click here to edit."
            // "Type _Markdown_ and LaTeX: $\\alpha^2$" +
            //     "<!-- " +
            //     "The above text is Markdown and LaTeX markup.\n" +
            //     "It is provided as a quick sample of what you can do in a Markdown cell.\n" +
            //     "Markdown cells are marked with the paragraph icon.\n" +
            //     "This is a comment, so it does not appear when rendered.\n" +
            //     "Also note that the first item in the cell or the first first-level" +
            //     "header will appear as the cell title." +
            //     "-->"
    };

    // KEYBOARD MANAGER

    /*
     * Ensure that the keyboard manager does not reactivate during interaction
     * with the Narrative.
     *
     * Although we disable the keyboard manager at the outset, Jupyter will
     * hook into the blur event for inputs  within an inserted dom node.
     * This causes havoc when kbase widgets manipulate the dom by inserting
     * form controls.
     *
     * So ... we just disable this behavior by overriding the register_events
     * method.
     *
     */

     (function () {
         keyboardManager.KeyboardManager.prototype.register_events = function (e) {
             // NOOP
             return;
         };
     }());



    // CODE CELL

    /*
     * NEW:
     *
     * Extend the CodeCell bind_events method to add handling of toolbar
     * events.
     *
     *  A note on "extension" of a function object's function prototype:
     *  We first save the existing function, and then replace it with a new
     *  one which in its first statement executes the original one.
     *  This represents the existing behavior.
     *  Code following this represents the additional or extended behavior.
     *
     */
    (function () {
        var p = codeCell.CodeCell.prototype,
            originalMethod;

        p.minimize = function () {
            var inputArea = this.input.find('.input_area'),
                outputArea = this.element.find('.output_wrapper');

            inputArea.addClass('hidden');
            outputArea.addClass('hidden');
        };

        p.maximize = function () {
            var inputArea = this.input.find('.input_area'),
                outputArea = this.element.find('.output_wrapper');

            inputArea.removeClass('hidden');
            outputArea.removeClass('hidden');
        };

        // We need this method because the layout of each type of cell and
        // interactions with min/max can be complex.
        p.renderIcon = function () {
            var prompt = this.element.querySelector('.input_prompt');

            if (!prompt) {
                return;
            }

            prompt.innerHTML = 'prompt here';
        };

        p.getIcon = function () {
            var iconColor = 'silver';

            return span({style: ''}, [
                span({class: 'fa-stack fa-2x', style: {textAlign: 'center', color: iconColor}}, [
                    span({class: 'fa fa-square fa-stack-2x', style: {color: iconColor}}),
                    span({class: 'fa fa-inverse fa-stack-1x fa-' + 'terminal'})
                ])
            ]);
        };

        originalMethod = codeCell.CodeCell.prototype.bind_events;
        p.bind_events = function () {
            originalMethod.apply(this);
            var $cellNode = $(this.element),
                thisCell = this;

            // TODO: toggle state on the cell object so we can be sure about this.

            $cellNode.on('unselected.cell', function () {
                var $menu = $(thisCell.celltoolbar.element).find('.button_container');
                utils.setCellMeta(cell, 'kbase.cellState.selected', false);
                // thisCell.setCellState('selected', false);
                $menu.trigger('unselected.toolbar');
            });

            // this.events
            $cellNode.on('selected.cell', function () {
                var $menu = $(thisCell.celltoolbar.element).find('.button_container');
                // thisCell.setCellState('selected', true);
                utils.setCellMeta(cell, 'kbase.cellState.selected', true);
                $menu.trigger('selected.toolbar');
            });


            $cellNode.on('toggleCodeArea.cell', function () {
                thisCell.toggleCodeInputArea();
            });

            $cellNode.on('hideCodeArea.cell', function () {
                thisCell.hideCodeInputArea();
            });

            if (this.code_mirror) {
                this.code_mirror.on("change", function(cm, change) {
                    // alert(' Rendering code cell ', cm, change);
                    var lineCount = cm.lineCount(),
                        commentRe = /^\.*?\#\s*(.*)$/;
                    for (var i = 0; i < lineCount; i += 1) {
                        var line = cm.getLine(i),
                            m = commentRe.exec(line);
                        if (m) {
                            utils.setCellMeta(thisCell, 'kbase.attributes.title', m[1], true);
                            break;
                        }
                    }
                    // console.log('Code mirror?', cm, change);
                    // utils.setCellMeta(cell, 'kbase.attributes.title', 'some title');
                });
            }
        };

        p.hideCodeInputArea = function () {
            var codeInputArea = this.input.find('.input_area')[0];
            if (codeInputArea) {
                codeInputArea.classList.add('hidden');
            }
        };

        p.isCodeShowing = function () {
            var codeInputArea = this.input.find('.input_area')[0];
            if (codeInputArea) {
                return !codeInputArea.classList.contains('hidden');
            }
            return false;
        };

        p.toggleCodeInputArea = function() {
            var codeInputArea = this.input.find('.input_area')[0];
            if (codeInputArea) {
                codeInputArea.classList.toggle('hidden');
                this.metadata = this.metadata;
            }
        };
    }());

    /*
     * NEW:
     *
     * Hides and shows code cell components based on the current toggle
     * state of the cell, as reflected in the cell metadata
     * (via getCellState).
     */
    notebook.Notebook.prototype.eachCell = function (fun) {
        var cells = this.get_cells();
        cells.forEach(function (cell) {
            fun(cell);
        });
    };


    // Patch the Notebook to return the right name
    notebook.Notebook.prototype.get_notebook_name = function () {
        if (!this.metadata.name) {
            this.metadata.name = this.notebook_name;
        }
        return this.metadata.name;
    };

    // Patch the Notebook to not wedge a file extension on a new Narrative name
    notebook.Notebook.prototype.rename = function (new_name) {
        var that = this;
        var parent = nbUtils.url_path_split(this.notebook_path)[0];
        var new_path = nbUtils.url_path_join(parent, new_name);
        return this.contents.rename(this.notebook_path, new_path).then(
            function (json) {
                that.notebook_name = json.name;
                that.notebook_path = json.path;
                that.last_modified = new Date(json.last_modified);
                // that.session.rename_notebook(json.path);
                that.events.trigger('notebook_renamed.Notebook', json);
            }
        );
    };

    // Patch the save widget to skip the 'notebooks' part of the URL when updating
    // after a notebook rename.
    saveWidget.SaveWidget.prototype.update_address_bar = function () {
        var base_url = this.notebook.base_url;
        var path = this.notebook.notebook_path;
        var state = {path : path};
        window.history.replaceState(state, "", nbUtils.url_path_join(
            base_url,
            nbUtils.encode_uri_components(path))
        );
    };

    // Patch the save widget to take in options at save time
    saveWidget.SaveWidget.prototype.rename_notebook = function (options) {
        options = options || {};
        var that = this;
        var dialog_body = $('<div>').append(
            $('<p>').addClass('rename-message')
            .text(options.message ? options.message : 'Enter a new Narrative name:')
            ).append(
            $('<br>')
            ).append(
            $('<input>').attr('type', 'text').attr('size', '25').addClass('form-control')
            .val(options.notebook.get_notebook_name())
            );
        var d = dialog.modal({
            title: 'Rename Narrative',
            body: dialog_body,
            notebook: options.notebook,
            keyboard_manager: this.keyboard_manager,
            buttons: {
                'OK': {
                    class: 'btn-primary',
                    click: function () {
                        var new_name = d.find('input').val();
                        d.find('.rename-message').text('Renaming and saving...');
                        d.find('input[type="text"]').prop('disabled', true);
                        that.notebook.rename(new_name).then(
                            function () {
                                d.modal('hide');
                                that.notebook.metadata.name = new_name;
                                that.element.find('span.filename').text(new_name);
                                Jupyter.narrative.saveNarrative();
                                if (options.callback) {
                                    options.callback();
                                }
                            },
                            function (error) {
                                d.find('.rename-message').text(error.message || 'Unknown error');
                                d.find('input[type="text"]').prop('disabled', false).focus().select();
                            }
                        );
                        return false;
                    }
                },
                'Cancel': {}
            },
            open: function () {
                /**
                 * Upon ENTER, click the OK button.
                 */
                d.find('input[type="text"]').keydown(function (event) {
                    if (event.which === keyboard.keycodes.enter) {
                        d.find('.btn-primary').first().click();
                        return false;
                    }
                });
                d.find('input[type="text"]').focus().select();
            }
        });
    };
});
