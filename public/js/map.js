google.load('visualization', '1', {'packages':['geochart']});
  google.setOnLoadCallback(drawRegionsMap);
  function drawRegionsMap() {
    var data = google.visualization.arrayToDataTable([
    ['State', 'Members of Congress'],
    ['Alabama', 9],
    ['Alaska', 3],
    ['Arizona', 11],
    ['Arkansas', 6],
    ['California', 55],
    ['Colorado', 9],
    ['Connecticut', 7],
    ['Delaware', 3],
    ['District of Columbia', 1],
    ['Florida', 29],
    ['Georgia', 16],
    ['Hawaii', 4],
    ['Idaho', 4],
    ['Illinois', 20],
    ['Indiana', 11],
    ['Iowa', 6],
    ['Kansas', 6],
    ['Kentucky', 8],
    ['Louisiana', 8],
    ['Maine', 4],
    ['Maryland', 10],
    ['Massachusetts', 11],
    ['Michigan', 16],
    ['Minnesota', 10],
    ['Mississippi', 6],
    ['Missouri', 10],
    ['Montana', 3],
    ['Nebraska', 5],
    ['Nevada', 6],
    ['New Hampshire', 4],
    ['New Jersey', 14],
    ['New Mexico', 5],
    ['New York', 29],
    ['North Carolina', 15],
    ['North Dakota', 3],
    ['Ohio', 18],
    ['Oklahoma', 7],
    ['Oregon', 7],
    ['Pennsylvania', 20],
    ['Rhode Island', 4],
    ['South Carolina', 9],
    ['South Dakota', 3],
    ['Tennessee', 11],
    ['Texas', 38],
    ['Utah', 6],
    ['Vermont', 3],
    ['Virginia', 13],
    ['Virgin Islands', 1],
    ['Washington', 12],
    ['West Virginia', 5],
    ['Wisconsin', 10],
    ['Wyoming', 3]
 ]);

    var options = {
        colorAxis: {colors: ['#f5f5f5','#428bca']},
        legend: 'Visits',
        region: "US",
        resolution: 'provinces',
        backgroundColor:{
                    fill: '#f5f5f5', 
                    stroke: '#428bca', 
                    strokeWidth: 5},
        width: 750
    };

    var chart = new google.visualization.GeoChart(document.getElementById('chart_div'));
    chart.draw(data, options);
    
    google.visualization.events.addListener(chart, 'select', function() {
        var selectionIdx = chart.getSelection()[0].row;
        var stateName = data.getValue(selectionIdx, 0);
        window.location.replace('state/' + stateName);
    });            
  }