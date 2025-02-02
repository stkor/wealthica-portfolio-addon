import React, { Component } from 'react';
import { Position, Account } from '../types';
import Collapsible from 'react-collapsible';
import { getSymbol, formatCurrency, getURLParams, formatMoney } from '../utils';
import Charts from './Charts';
import moment from 'moment';
import _ from 'lodash';
import * as Highcharts from 'highcharts';
import StockTimeline from './StockTimeline';
import { TYPE_TO_COLOR } from '../constants';

type Props = {
  positions: Position[];
  accounts: Account[];
  isPrivateMode: boolean;
  addon?: any;
};

type State = {
  timelineSymbol?: string;
};

export default class HoldingsCharts extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      timelineSymbol: undefined,
    };
  }

  getDrillDown(): any {
    return {
      activeAxisLabelStyle: {
        textDecoration: 'none',
      },
      activeDataLabelStyle: {
        textDecoration: 'none',
      },

      series: this.props.positions.map(position => {
        return {
          type: 'column',
          id: getSymbol(position.security),
          name: getSymbol(position.security),
          data: position.transactions.map(transaction => {
            const isBuySell = ['buy', 'sell'].includes(transaction.type);
            const type = _.startCase(transaction.type);
            return {
              name: moment(transaction.date).format('MMM D, Y'),
              y: transaction.amount,
              color: TYPE_TO_COLOR[transaction.type.toLowerCase()],
              displayValue: formatMoney(transaction.amount),
              type,
              price: isBuySell ? transaction.price : 'N/A',
              shares: isBuySell ? transaction.shares : 'N/A',
              label: isBuySell
                ? `${transaction.shares}@${transaction.price}`
                : `${type}@${formatMoney(transaction.amount)}`,
              transaction,
            };
          }),
          legend: {
            enabled: true,
            align: 'right',
            verticalAlign: 'top',
            layout: 'vertical',
            x: 0,
            y: 100,
          },

          tooltip: {
            useHTML: true,
            pointFormat: `<b>{point.label}</b>
            <br />Type: {point.type}`,
            valueDecimals: 1,
          },
          dataLabels: {
            enabled: !this.props.isPrivateMode,
            format: '{point.label}',
          },
          // showInLegend: true,
        };
      }),
    };
  }

  getPositionsSeries() {
    const marketValue = this.props.positions.reduce((sum, position) => {
      return sum + position.market_value;
    }, 0);
    const data = this.props.positions
      .sort((a, b) => b.market_value - a.market_value)
      .map(position => {
        const symbol = getSymbol(position.security);

        const accounts = (this.props.accounts || [])
          .map(account => {
            const position = account.positions.filter(position => position.symbol === symbol)[0];
            return position ? { name: account.name, type: account.type, quantity: position.quantity } : undefined;
          })
          .filter(value => value)
          .sort((a, b) => b!.quantity - a!.quantity)
          .map(value => `<tr><td>${value!.name} ${value!.type}</td><td align="right">${value!.quantity}</td></tr>`)
          .join('');

        return {
          name: getSymbol(position.security),
          // drilldown: getSymbol(position.security),
          y: position.market_value,
          displayValue: formatCurrency(position.market_value, 1),
          marketValue: formatMoney(position.market_value),
          percentage: position.market_value ? (position.market_value / marketValue) * 100 : 0,
          gain: position.gain_percent ? position.gain_percent * 100 : position.gain_percent,
          profit: formatMoney(position.gain_amount),
          buyPrice: formatMoney(
            position.investments.reduce((cost, investment) => {
              return cost + investment.book_value / investment.quantity;
            }, 0) / position.investments.length,
          ),
          shares: position.quantity,
          lastPrice: formatMoney(position.security.last_price),
          currency: position.security.currency ? position.security.currency.toUpperCase() : position.security.currency,
          accountsTable: `<table><tr><th>Account</th><th align="right">Shares</th></tr>${accounts}</table>`,
        };
      });

    const events = {
      click: event => {
        if (event.point.name && this.state.timelineSymbol !== event.point.name) {
          this.setState({ timelineSymbol: event.point.name });
        }
      },
    };

    return [
      {
        type: 'column',
        name: 'Holdings',
        colorByPoint: true,
        data,
        events,

        tooltip: {
          useHTML: true,

          pointFormat: `<b>C$ {point.marketValue}</b><br /><br />
          <table width="100%">
            <tr><td>Weightage</td><td align="right">{point.percentage:.1f}%</td></tr>
            <tr><td>Gain</td><td align="right">{point.gain:.1f}%</td></tr>
            <tr><td>Profit</td><td align="right">C$ {point.profit}</td></tr>
            <tr><td>Shares</td><td align="right">{point.shares}</td></tr>
            <tr><td>Currency</td><td align="right">{point.currency}</td></tr>
            <tr><td>Buy Price</td><td align="right">{point.buyPrice}</td></tr>
            <tr><td>Last Price</td><td align="right">{point.lastPrice}</td></tr>
          </table>
          <br />{point.accountsTable}
          `,
          valueDecimals: 1,
        },
        dataLabels: {
          enabled: !this.props.isPrivateMode,
          format: '{point.displayValue}',
        },
        showInLegend: false,
      },
      {
        type: 'pie',
        name: 'Holdings',
        colorByPoint: true,
        data: data.map(position => ({ ...position, drilldown: undefined })),
        events,

        tooltip: {
          useHTML: true,
          pointFormat: `<b>{point.percentage:.1f}%</b><br /><br />
          <table width="100%">
            <tr><td>Value</td><td align="right">C$ {point.marketValue}</td></tr>
            <tr><td>Gain</td><td align="right">{point.gain:.1f}%</td></tr>
            <tr><td>Profit</td><td align="right">C$ {point.profit}</td></tr>
            <tr><td>Shares</td><td align="right">{point.shares}</td></tr>
            <tr><td>Currency</td><td align="right">{point.currency}</td></tr>
            <tr><td>Buy Price</td><td align="right">{point.buyPrice}</td></tr>
            <tr><td>Last Price</td><td align="right">{point.lastPrice}</td></tr>
          </table>
          <br />{point.accountsTable}
          `,
        },
      },
    ];
  }

  getTopGainersLosers(gainers: boolean) {
    return [
      {
        name: gainers ? 'Top Gainers' : 'Top Losers',
        type: 'column',
        colorByPoint: true,
        data: this.props.positions
          .filter(position => (gainers ? position.gain_percent > 0 : position.gain_percent <= 0))
          .sort((a, b) => a.gain_percent - b.gain_percent)
          .map(position => {
            return {
              name: getSymbol(position.security),
              y: position.gain_percent * 100,
              gain: formatMoney(position.gain_amount),
            };
          }),
        tooltip: {
          pointFormat: gainers
            ? '<b>{point.y:.1f}%</b><br />Gain: {point.gain} CAD'
            : '<b>{point.y:.1f}%</b><br />Loss: {point.gain} CAD',
        },
        dataLabels: {
          enabled: true,
          format: '{point.y:.1f}',
        },
        showInLegend: false,
      },
    ];
  }

  getUSDCADSeries() {
    const cashByCurrency = this.props.accounts.reduce((hash, account) => {
      const data = hash[account.currency] || { type: 'Cash', currency: account.currency, value: 0 };
      data.value += account.cash;
      hash[account.currency] = data;
      return hash;
    }, {});
    const positionDataByCurrency = this.props.positions.reduce((hash, position) => {
      const data = hash[position.security.currency] || {
        type: 'Stocks',
        currency: position.security.currency,
        value: 0,
        gain: 0,
      };
      data.value += position.market_value;
      data.gain += position.gain_amount;
      hash[position.security.currency] = data;
      return hash;
    }, {});
    const totalValue = Number(
      Object.keys(positionDataByCurrency)
        .reduce(
          (sum, currency) => {
            return sum + positionDataByCurrency[currency].value;
          },
          Object.keys(cashByCurrency).reduce((sum, currency) => {
            return sum + cashByCurrency[currency].value;
          }, 0),
        )
        .toFixed(2),
    ).toLocaleString();

    return {
      type: 'pie',
      name: 'USD vs CAD',
      colorByPoint: true,
      // center: ['80%', '30%'],
      // size: 150,
      data: Object.keys(positionDataByCurrency)
        .map(currency => {
          const data = positionDataByCurrency[currency];
          return {
            name: `${currency.toUpperCase()} Stocks`,
            y: data.value,
            displayValue: data.value ? Number(data.value.toFixed(2)).toLocaleString() : data.value,
            totalValue,

            additionalValue: `<tr><td>Gain ($) </td><td align="right">${formatMoney(data.gain)}</td></tr>
            <tr><td>Gain (%)</td><td align="right">${((data.gain / data.value) * 100).toFixed(2)}</td></tr>
            `,
          };
        })
        .concat(
          Object.keys(cashByCurrency).map(currency => {
            const data = cashByCurrency[currency];
            const accountsTable = this.props.accounts
              .filter(account => account.currency === currency && account.cash)
              .sort((a, b) => b.cash - a.cash)
              .map(account => {
                return `
                  <tr>
                    <td>${account.name} ${account.type}</td>
                    <td align="right">$${
                      account.cash ? Number(account.cash.toFixed(2)).toLocaleString() : account.cash
                    }</td>
                  </tr>`;
              })
              .join('');

            return {
              name: `${currency.toUpperCase()} Cash`,
              y: data.value,
              displayValue: data.value ? Number(data.value.toFixed(2)).toLocaleString() : data.value,
              totalValue,

              additionalValue: accountsTable,
            };
          }),
        ),
      tooltip: {
        useHTML: true,
        pointFormat: `<b>{point.percentage:.1f}%</b><br /><br />
        <table><tr><td>Value</td><td align="right">\${point.displayValue}</td></tr>
        <tr><td>Total Value</td><td align="right">\${point.totalValue}</td></tr>
        <tr><td colspan="2">======================</td></tr>
        {point.additionalValue}
        </table>`,
      },
    };
  }

  getOptions = ({
    title,
    yAxisTitle,
    subtitle,
    series,
    drilldown,
  }: {
    series: any;
    title?: string;
    subtitle?: string;
    yAxisTitle?: string;
    drilldown?: boolean;
  }): Highcharts.Options => {
    return {
      series,
      drilldown: drilldown ? this.getDrillDown() : {},

      tooltip: {
        outside: true,

        useHTML: true,
        backgroundColor: '#FFF',
        style: {
          color: '#1F2A33',
        },
      },

      title: {
        text: title,
      },
      subtitle: {
        text: subtitle,
        style: {
          color: '#1F2A33',
        },
      },
      xAxis: {
        type: 'category',
        labels: {
          rotation: -45,
          style: {
            fontSize: '13px',
            fontFamily: 'Verdana, sans-serif',
          },
        },
      },

      yAxis: {
        labels: {
          enabled: !this.props.isPrivateMode,
        },
        title: {
          text: yAxisTitle,
        },
      },

      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: true,
            format: '<b>{point.name}</b>: {point.percentage:.1f} %',
            style: {
              color: 'black',
            },
          },
        },
      },
    };
  };

  getPortfolioVisualizerLink() {
    const marketValue = this.props.positions.reduce((sum, position) => {
      return sum + position.market_value;
    }, 0);

    let remainingWeightage = 100;
    const params = getURLParams(
      this.props.positions.reduce((hash, position, index) => {
        // symbol1=QD&allocation1_1=1&
        // symbol2=TTD&allocation2_1=15
        let weightage = Number(((position.market_value / marketValue) * 100).toFixed(1));
        remainingWeightage -= weightage;
        remainingWeightage = Number(remainingWeightage.toFixed(1));
        if (index + 1 == this.props.positions.length) {
          weightage += remainingWeightage;
        }
        hash[`symbol${index + 1}`] = getSymbol(position.security);
        hash[`allocation${index + 1}_1`] = weightage;
        return hash;
      }, {}),
    );
    return `https://www.portfoliovisualizer.com/backtest-portfolio?s=y&timePeriod=4&initialAmount=10000&annualOperation=0&annualAdjustment=0&inflationAdjusted=true&annualPercentage=0.0&frequency=4&rebalanceType=1&showYield=false&reinvestDividends=true&${params}#analysisResults`;
  }

  renderStockTimeline() {
    if (!this.state.timelineSymbol) {
      return <></>;
    }
    const position = this.props.positions.filter(
      position => getSymbol(position.security) === this.state.timelineSymbol,
    )[0];

    if (!position) {
      return <></>;
    }

    return (
      <StockTimeline
        isPrivateMode={this.props.isPrivateMode}
        symbol={this.state.timelineSymbol}
        position={position}
        addon={this.props.addon}
      />
    );
  }

  render() {
    const positionSeries = this.getPositionsSeries();

    return (
      <>
        <Collapsible trigger="Holdings Chart" open>
          <Charts
            options={this.getOptions({
              yAxisTitle: 'Market Value ($)',
              subtitle: '(click on a stock to view transactions)',
              series: [positionSeries[0]],
              drilldown: false,
            })}
          />

          <Charts
            options={this.getOptions({
              subtitle: '(click on a stock to view timeline and transactions)',
              series: [positionSeries[1]],
            })}
          />
          {this.renderStockTimeline()}

          <div className="center">
            <div
              className="button"
              onClick={() => {
                window.open(this.getPortfolioVisualizerLink(), '_blank');
              }}
            >
              Portfolio Visualizer
            </div>
          </div>
        </Collapsible>

        <Collapsible trigger="USD/CAD Composition" open>
          <Charts options={this.getOptions({ title: 'USD/CAD Composition', series: [this.getUSDCADSeries()] })} />
        </Collapsible>

        <Collapsible trigger="Top Losers/Gainers Chart" open>
          <Charts
            options={this.getOptions({
              title: 'Top Gainers',
              yAxisTitle: 'Gain (%)',
              series: this.getTopGainersLosers(true),
            })}
          />
          <Charts
            options={this.getOptions({
              title: 'Top Losers',
              yAxisTitle: 'Loss (%)',
              series: this.getTopGainersLosers(false),
            })}
          />
        </Collapsible>
      </>
    );
  }
}
