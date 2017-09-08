jQuery(function () {
    var Super = RT.LifecycleViewer;

    function Editor (container) {
        Super.call(this);
        this.padding = this.statusCircleRadius * 2;
    };
    Editor.prototype = Object.create(Super.prototype);

    Editor.prototype._initializeTemplates = function (container) {
        var self = this;

        Handlebars.registerHelper('select', function(value, options) {
            var node = jQuery('<select />').html( options.fn(this) );
            node.find('[value="' + value + '"]').attr({'selected':'selected'});
            return node.html();
        });

        Handlebars.registerHelper('canAddTransition', function(fromStatus, toStatus, lifecycle) {
            if (fromStatus == toStatus) {
                return false;
            }
            return !lifecycle.hasTransition(fromStatus, toStatus);
        });

        Handlebars.registerHelper('canSelectTransition', function(fromStatus, toStatus, lifecycle) {
            return lifecycle.hasTransition(fromStatus, toStatus);
        });

        Handlebars.registerHelper('truncate', function(text) {
            if (text.length > 15) {
                text = text.substr(0, 15) + '…';
            }
            return text;
        });

        var templates = {};
        self.container.find('script.lifecycle-inspector-template').each(function () {
            var type = jQuery(this).data('type');
            var template = jQuery(this).html();
            var fn = Handlebars.compile(template);
            templates[type] = fn;
            Handlebars.registerPartial('lifecycleui_' + type, fn);
        });
        return templates;
    };

    Editor.prototype.setInspectorContent = function (node) {
        var self = this;
        var lifecycle = self.lifecycle;
        var inspector = self.inspector;
        self.inspectorNode = node;

        var type = node ? node._type : 'canvas';

        var params = { lifecycle: lifecycle };
        params[type] = node;

        inspector.find('.content').html(self.templates[type](params));

        inspector.find(".toplevel").addClass('sf-menu sf-vertical sf-js-enabled sf-shadow').supersubs().superfish({ speed: 'fast' });

        inspector.find(':checkbox[data-show-hide]').each(function () {
            var field = jQuery(this);
            var selector = field.data('show-hide');
            var toggle = function () {
                if (field.prop('checked')) {
                    jQuery(selector).show();
                } else {
                    jQuery(selector).hide();
                }
            }
            field.change(function (e) { toggle() });
            toggle();
        });
    };

    Editor.prototype.bindInspectorEvents = function () {
        var self = this;
        var lifecycle = self.lifecycle;
        var inspector = self.inspector;

        inspector.on('change', ':input', function () {
            var field = this.name;
            var value;
            if (jQuery(this).is(':checkbox')) {
                value = this.checked;
            }
            else {
                value = jQuery(this).val();
            }

            var action = jQuery(this).closest('li.action');
            if (action.length) {
                var action = lifecycle.itemForKey(action.data('key'));
                lifecycle.updateItem(action, field, value);
            }
            else if (inspector.find('.canvas').length) {
                lifecycle.update(field, value);
            }
            else {
                lifecycle.updateItem(self.inspectorNode, field, value);
            }
            self.renderDisplay();
        });

        inspector.on('click', 'button.change-color', function (e) {
            e.preventDefault();
            var container = jQuery(this).closest('.color-control');
            var field = container.data('field');
            var picker = jQuery('<div class="color-picker"></div>');
            jQuery(this).replaceWith(picker);

            var skipUpdateCallback = 0;
            var farb = jQuery.farbtastic(picker, function (newColor) {
                if (skipUpdateCallback) {
                    return;
                }
                container.find('.current-color').val(newColor);
                lifecycle.updateItem(self.inspectorNode, field, newColor, true);
                self.renderDisplay();
            });
            farb.setColor(self.inspectorNode[field]);

            // see farbtastic's implementation
            jQuery('*', picker).mousedown(function () {
                self.lifecycle.beginChangingColor();
            });

            var input = jQuery('<input class="current-color" size=8 maxlength=7>');
            container.find('.current-color').replaceWith(input);
            input.on('input', function () {
                var newColor = input.val();
                if (newColor.match(/^#[a-fA-F0-9]{6}$/)) {
                    skipUpdateCallback = 1;
                    farb.setColor(newColor);
                    skipUpdateCallback = 0;

                    lifecycle.updateItem(self.inspectorNode, field, newColor);
                    self.renderDisplay();
                }
            });
            input.val(self.inspectorNode[field]);
        });

        inspector.on('click', 'button.delete', function (e) {
            e.preventDefault();

            var action = jQuery(this).closest('li.action');
            if (action.length) {
                lifecycle.deleteActionForTransition(self.inspectorNode, action.data('key'));
                action.slideUp(200, function () { jQuery(this).remove() });
            }
            else {
                lifecycle.deleteItemForKey(self.inspectorNode._key);
                self.defocus();
            }
        });

        inspector.on('click', 'button.add-action', function (e) {
            e.preventDefault();
            var action = lifecycle.createActionForTransition(self.inspectorNode);

            var params = {action:action, lifecycle:lifecycle};
            var html = self.templates.action(params);
            jQuery(html).appendTo(inspector.find('ul.actions'))
                        .hide()
                        .slideDown(200);
        });

        inspector.on('click', 'a.add-transition', function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            lifecycle.addTransition(fromStatus, toStatus);

            button.closest('li').addClass('hidden');

            inspector.find('a.select-transition[data-from="'+fromStatus+'"][data-to="'+toStatus+'"]').closest('li').removeClass('hidden');

            self.renderDisplay();
        });

        inspector.on('click', 'a.select-status', function (e) {
            e.preventDefault();
            var statusName = jQuery(this).data('name');
            var d = self.lifecycle.statusObjectForName(statusName);
            self.focusItem(d);
        });

        inspector.on('click', 'a.select-transition', function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            var d = self.lifecycle.hasTransition(fromStatus, toStatus);
            self.focusItem(d);
        });

        inspector.on('click', 'a.select-decoration', function (e) {
            e.preventDefault();
            var key = jQuery(this).data('key');
            var d = self.lifecycle.itemForKey(key);
            self.focusItem(d);
        });

        inspector.on('click', '.add-status', function (e) {
            e.preventDefault();
            self.addNewStatus();
        });

        inspector.on('click', '.add-text', function (e) {
            e.preventDefault();
            self.addNewTextDecoration();
        });

        inspector.on('click', '.add-polygon', function (e) {
            e.preventDefault();
            self.addNewPolygonDecoration(jQuery(this).data('type'));
        });

        inspector.on('click', '.add-circle', function (e) {
            e.preventDefault();
            self.addNewCircleDecoration();
        });

        inspector.on('click', '.add-line', function (e) {
            e.preventDefault();
            self.addNewLineDecoration();
        });

        inspector.on('click', 'button.undo', function (e) {
            e.preventDefault();
            var frame = self.lifecycle.undo();
            var uiState = frame[1];

            if (uiState.focusKey) {
                var node = self.lifecycle.itemForKey(uiState.focusKey);
                self.focusItem(node);
            }
            else {
                self.defocus();
            }
        });

        inspector.on('click', 'button.redo', function (e) {
            e.preventDefault();
            var frame = self.lifecycle.redo();
            var uiState = frame[1];

            if (uiState.focusKey) {
                var node = self.lifecycle.itemForKey(uiState.focusKey);
                self.focusItem(node);
            }
            else {
                self.defocus();
            }
        });
    };

    Editor.prototype.addPointHandles = function (d) {
        var self = this;
        var points = [];
        for (var i = 0; i < d.points.length; ++i) {
            points.push({
                _key: d._key + '-' + i,
                i: i,
                x: d.points[i].x,
                y: d.points[i].y,
                xScale: d._type == 'polygon' ? function (v) { return self.xScaleZero(v) } : function (v) { return self.xScale(v) },
                yScale: d._type == 'polygon' ? function (v) { return self.yScaleZero(v) } : function (v) { return self.yScale(v) },
                xScaleInvert: d._type == 'polygon' ? function (v) { return self.xScaleZeroInvert(v) } : function (v) { return self.xScaleInvert(v) },
                yScaleInvert: d._type == 'polygon' ? function (v) { return self.yScaleZeroInvert(v) } : function (v) { return self.yScaleInvert(v) }
            });
        }
        self.pointHandles = points;
    };

    Editor.prototype.removePointHandles = function () {
        if (!this.pointHandles) {
            return;
        }

        delete this.pointHandles;
        this.renderDecorations();
    };

    Editor.prototype.didDragPointHandle = function (d, node) {
        var x = d.xScaleInvert(d3.event.x);
        var y = d.yScaleInvert(d3.event.y);

        if (d.xScale(x) == d.xScale(d.x) && d.yScale(y) == d.yScale(d.y)) {
            return;
        }

        if (!d._dragging) {
            this.lifecycle.beginDragging();
            d._dragging = true;
        }

        d.x = x;
        d.y = y;

        this.lifecycle.movePolygonPoint(this.inspectorNode, d.i, x, y);

        this.renderDisplay();
    };

    // add a rect under the focused text decoration for highlighting
    Editor.prototype.renderTextDecorations = function (initial) {
        Super.prototype.renderTextDecorations.call(this, initial);
        var self = this;

        if (!self._focusItem || self._focusItem._type != 'text') {
            self.decorationContainer.selectAll("rect")
                .data([])
                .exit()
                .remove();
            return;
        }

        var d = self._focusItem;
        var label = self.decorationContainer.select("text[data-key='"+d._key+"']");
        var rect = label.node().getBoundingClientRect();
        var width = rect.width;
        var height = rect.height;
        var padding = 5;

        var background = self.decorationContainer.selectAll("rect")
                             .data([d], function (d) { return d._key });

        background.enter().insert("rect", ":first-child")
                     .classed("text-background", true)
              .merge(background)
                     .attr("x", self.xScale(d.x)-padding)
                     .attr("y", self.yScale(d.y)-height-padding)
                     .attr("width", width+padding*2)
                     .attr("height", height+padding*2)
    };

    Editor.prototype.renderPolygonDecorations = function (initial) {
        Super.prototype.renderPolygonDecorations.call(this, initial);

        var self = this;
        var handles = self.decorationContainer.selectAll("circle.point-handle")
                           .data(self.pointHandles || [], function (d) { return d._key });

        handles.exit()
              .remove();

        handles.enter().append("circle")
                     .classed("point-handle", true)
                     .call(d3.drag()
                         .subject(function (d) { return { x: d.xScale(d.x), y : d.yScale(d.y) } })
                         .on("start", function (d) { self.didBeginDrag(d, this) })
                         .on("drag", function (d) { self.didDragPointHandle(d) })
                         .on("end", function (d) { self.didEndDrag(d, this) })
                     )
              .merge(handles)
                     .attr("transform", function (d) { return self.inspectorNode._type == 'polygon' ? "translate(" + self.xScale(self.inspectorNode.x) + ", " + self.yScale(self.inspectorNode.y) + ")" : 'translate(0, 20)'})
                     .attr("cx", function (d) { return d.xScale(d.x) })
                     .attr("cy", function (d) { return d.yScale(d.y) })
    };

    Editor.prototype.clickedStatus = function (d) {
        this.focusItem(d);
    };

    Editor.prototype.clickedTransition = function (d) {
        this.focusItem(d);
    };

    Editor.prototype.clickedDecoration = function (d) {
        this.focusItem(d);
    };

    Editor.prototype.didBeginDrag = function (d, node) { };

    Editor.prototype.didEndDrag = function (d, node) {
        d._dragging = false;
    };

    Editor.prototype.didDragItem = function (d, node) {
        if (this.inspectorNode && this.inspectorNode._key != d._key) {
            return;
        }

        var x = this.xScaleInvert(d3.event.x);
        var y = this.yScaleInvert(d3.event.y);

        if (this.xScale(x) == this.xScale(d.x) && this.yScale(y) == this.yScale(d.y)) {
            return;
        }

        if (!d._dragging) {
            this.lifecycle.beginDragging();
            d._dragging = true;
        }

        this.lifecycle.moveItem(d, x, y);
        this.renderDisplay();
    };

    Editor.prototype._createDrag = function () {
        var self = this;
        return d3.drag()
                 .subject(function (d) { return { x: self.xScale(d.x), y : self.yScale(d.y) } })
                 .on("start", function (d) { self.didBeginDrag(d, this) })
                 .on("drag", function (d) { self.didDragItem(d, this) })
                 .on("end", function (d) { self.didEndDrag(d, this) })
    };

    Editor.prototype.didEnterStatusNodes = function (statuses) {
        statuses.call(this._createDrag());
    };

    Editor.prototype.didEnterStatusLabels = function (statuses) {
        statuses.call(this._createDrag());
    };

    Editor.prototype.didEnterTextDecorations = function (labels) {
        labels.call(this._createDrag());
    };

    Editor.prototype.didEnterPolygonDecorations = function (polygons) {
        polygons.call(this._createDrag());
    };

    Editor.prototype.didEnterCircleDecorations = function (circles) {
        circles.call(this._createDrag());
    };

    Editor.prototype.addNewStatus = function () {
        var status = this.lifecycle.createStatus();
        this.focusItem(status);
    };

    Editor.prototype.addNewTextDecoration = function () {
        var text = this.lifecycle.createTextDecoration();
        this.focusItem(text);
    };

    Editor.prototype.addNewPolygonDecoration = function (type) {
        var polygon = this.lifecycle.createPolygonDecoration(type);
        this.focusItem(polygon);
    };

    Editor.prototype.addNewCircleDecoration = function () {
        var circle = this.lifecycle.createCircleDecoration();
        this.focusItem(circle);
    };

    Editor.prototype.addNewLineDecoration = function () {
        var line = this.lifecycle.createLineDecoration();
        this.focusItem(line);
    };

    Editor.prototype.initializeEditor = function (node, name, config, focusStatus) {
        var self = this;
        self.initializeViewer(node, name, config, focusStatus);

        self.templates = self._initializeTemplates(self.container);
        self.inspector = self.container.find('.inspector');

        self.setInspectorContent(null);
        self.bindInspectorEvents();

        self.container.closest('form[name=ModifyLifecycle]').submit(function (e) {
            var config = self.lifecycle.exportAsConfiguration();
            var form = jQuery(this);
            var field = jQuery('<input type="hidden" name="Config">');
            field.val(JSON.stringify(config));
            form.append(field);
            return true;
        });

        self.svg.on('click', function () { self.defocus() });

        self.lifecycle.undoFrameCallback = function (frame) {
            var uiState = {};
            if (self._focusItem) {
                uiState.focusKey = self._focusItem._key;
            }
            frame.push(uiState);
        };

        self.lifecycle.undoStateChangedCallback = function () {
            d3.select(node).select('button.undo').classed('invisible', !self.lifecycle.hasUndoStack());
            d3.select(node).select('button.redo').classed('invisible', !self.lifecycle.hasRedoStack());
        };
        self.lifecycle.undoStateChangedCallback();
    };

    Editor.prototype.defocus = function () {
        Super.prototype.defocus.call(this);
        this.setInspectorContent(null);
        this.removePointHandles();
        this.renderDisplay();
    };

    Editor.prototype.focusItem = function (item) {
        Super.prototype.focusItem.call(this, item);
        this.setInspectorContent(item);

        if (item._type == 'polygon' || item._type == 'line') {
            this.addPointHandles(item);
        }

        this.renderDisplay();
    };

    RT.LifecycleEditor = Editor;
});
