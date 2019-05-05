import * as Highcharts from 'highcharts/highstock';
import HC_exporting from 'highcharts/modules/exporting';
import HC_ExportData from 'highcharts/modules/export-data';
import HighchartsReact from 'highcharts-react-official';

import React, { Component } from 'react';

HC_exporting(Highcharts);
HC_ExportData(Highcharts);

type Props = {
  options: Highcharts.Options;
  constructorType?: keyof typeof Highcharts;
};

export default class Charts extends Component<Props> {
  render() {
    const options = this.props.options;
    if (!options.exporting) {
      options.exporting = {};
    }
    return <HighchartsReact highcharts={Highcharts} constructorType={this.props.constructorType} options={options} />;
  }
}
