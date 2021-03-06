(function(ns, d3, $){

    d3.json('/affaires.json', function(data){
    d3.json('/assets/data/alternance.json', function(alter){

        var filtered = data.filter(function(e){
            return e.annee >= 1995;
        });

        /* Main chart */
        (function(data, alter){

            var chart1 = new ns.charts.Pourritures({ alter:  alter})
                .x(function(d) {
                    return d.formation;
                })
                .y(function(d) {
                    var date = new Date();
                    date.setYear(d.annee);
                    return date;
                })
                .tooltip(function(d){
                    var template = $('#tooltip-tmpl').html();
                    return _.template(template, d[0])
                });


            d3.select('.pourriture .chart')
                .datum(data)
                .call(chart1);
        })(filtered, alter);

        /* Pourriture list */
        (function(data){
            var f = $('.pourriture .filter-box'),
                c = f.find('.by-name'),
                a = '.pourriture .content circle',
                $a = $(a);

            d3.nest()
                .key(function(d){return d.name})
                .sortKeys(d3.ascending)
                .entries(data)
                .forEach(function(e){
                    c.append($('<li class="pourri"><label><input type="checkbox" name="'+ e.key.toLowerCase()+'">'+ e.key+'</label></li>'));
                });

            f.on('click','a', function(e){
                e.preventDefault();
                $('li.pourri input[type="checkbox"]').prop('checked',false);
                resetNameFilter();
            });
            f.on('change','li.pourri input', function(){
                var $this = $(this),
                    toShow = f.find('li.pourri input:checked').map(function(i,e){ return $(e).prop('name')}).toArray();

                if(toShow.length > 0) {
                    d3.selectAll(a)
                        .classed('hidden',true)
                        .filter(function(){
                            return toShow.indexOf(d3.select(this).attr("name")) >= 0;
                        }).classed('hidden',false);

                    if($this.is(':checked')) $a.tipsy('hide').filter('[name="'+$this.attr('name')+'"]').first().tipsy('show');
                    else $a.tipsy('hide')
                } else resetNameFilter();
            });
            function resetSearch() {
                c.find('input[type="checkbox"]').closest('li').fadeIn('fast');
            }
            function resetNameFilter() {
                d3.selectAll(a).classed('hidden', false);
                $a.tipsy('hide');
            }
            f.find('input[type="search"]').on('keyup', function(e){
                if($(this).val() === "") resetSearch();
                else c.find('li').show()
                    .find('input[type="checkbox"]:not(input[name*="'+$(this).val().toLowerCase()+'"])')
                    .closest('li').hide();
            });
            f.find('input[type="search"]').on('search', function(e){
                if($(this).val() === "") resetSearch();
            });
        })(filtered);

        /* High score chart */
        (function(data){
            var t = $('#highscore-tmpl').html();

            d3.nest()
                .key(function (d) { return d.name})
                .rollup(function (values) { return {
                    condamnations: d3.sum(values, function (d) {
                        return +d.infractions.length
                    }),
                    formation: values[0].formation,
                    lower: d3.min(values, function (d) {
                        return d.annee
                    }),
                    upper: d3.max(values, function (d) {
                        return d.annee
                    })
                }})
                .entries(data)
                .sort(function (a, b) {
                    return b.values.condamnations - a.values.condamnations
                })
                .slice(0, 3)
                .forEach(function(e,i){
                    var d = $.extend(e, e.values); // flatten the key and values
                    d.rank = i+1;
                    d.name = e.key;
                    $('.high-score').append(_.template(t,d))
                });

        })(filtered);


        /* Cumulated chart */
        (function(data){
            var cumulated = d3.nest()
                .key(function(d){return d.annee})
                .sortKeys(d3.ascending)
                .rollup(function(values){
                    var f = function (d) {return +d.infractions.length},
                        filter = function(g){ return function(d){ return d.formation === g}};
                    return [
                        d3.sum(values, f), // todo make this generic for every group
                        d3.sum(values.filter(filter("ps")), f),
                        d3.sum(values.filter(filter("ump")), f),
                        d3.sum(values.filter(filter("fn")), f)
                    ]
                })
                .entries(data)
                .map(function(d, i, arr){
                    d.values.push( (i > 0 ? arr[i-1].values[4] : 0) + d.values[0]);
                    return d;
                });

            var chart2 = new ns.charts.TimeSeries({width: 400, height:200})
                .x(function(d){
                    var date = new Date();
                    date.setYear(d.key);
                    return date;
                })
                .y(function (d) {return d.values[0]})
                .y2(function(d){ return d.values[4]});

            d3.select('.cumulated').datum(cumulated).call(chart2);
        })(filtered);

        /* TODO */
        (function(data){

            var natures = d3.keys(
                d3.merge(data.map(function (e) {return e.natures}))
                  .reduce(function (r, i) {
                    r["" + i] = i;
                    return r
                  }, {}));

            var byGroup = d3.nest()
                .key(function(d){
                    return d.formation
                })
                .rollup(function(affaires){
                    return {
                        "natures" : natures.map(function (e){
                            return {
                                "name":e,
                                "value": affaires.filter(function(i){ return i.natures.indexOf(e)>=0}).length
                            }
                    })};
                })
                .map(data);

            var r = d3.entries(byGroup).map(function(e){
                e.value.formation = e.key;
                return e.value;
            });
            var donuts = new ns.charts.Donuts();

            d3.select('.donuts').datum(r).call(donuts);

        })(filtered);

        /* Stacked */
        (function(data){

            var yAcessor = function (d) {return d.annee};
            var b = [d3.min(data, yAcessor), d3.max(data,yAcessor)];

            var r = d3.nest()
                .key(function(d){return d.formation})
                .key(function(d){return d.annee})
                .rollup(function(affaires){return affaires.length;})
                .entries(data).map(function(f){
                    var res = [];
                    for (var i = b[0]; i <= b[1]; i++) {

                        var item = f.values.filter(function(e){ return e.key == i });
                        res.push({
                            group: f.key,
                            date: ""+i,
                            value: item.length > 0 ? item[0].values : 0
                        })
                    }
                    return res;
                });

            var d = [].concat.apply([],r);

            var chart3 = ns.charts.Stacked({width: 800, height: 350})
                .tooltip(function(d){
                    var template = $('#stacked-tmpl').html();
                    return _.template(template, d)
                });
            d3.select('.stacked').datum(d).call(chart3);

        })(filtered)

        });
    });

}(window.pourritures = window.pourritures || {}, d3, jQuery));