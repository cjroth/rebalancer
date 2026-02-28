/**
 * Sample demo portfolios for common scenarios.
 * Each is a valid universal portfolio CSV string.
 */

export interface DemoScenario {
  id: string
  label: string
  description: string
  csv: string
}

export const demoScenarios: DemoScenario[] = [
  {
    id: 'couple-30s',
    label: 'Married couple, 30s',
    description: '~$350k across 5 accounts, growth-oriented 80/20 stocks/bonds',
    csv: `#holdings
account,symbol,shares
Alex_401k,VTI,320
Alex_401k,VXUS,280
Alex_401k,BND,150
Sam_401k,VTI,250
Sam_401k,VGT,45
Sam_401k,SCHD,200
Alex_Roth_IRA,VXUS,200
Alex_Roth_IRA,VNQ,100
Alex_Roth_IRA,VGT,30
Sam_Roth_IRA,VTI,100
Sam_Roth_IRA,VXUS,150
Sam_Roth_IRA,SCHD,100
Joint_Brokerage,SCHD,300
Joint_Brokerage,BND,200
Joint_Brokerage,CASH,5000

#symbols
name,price,countries,assets,beta
VTI,250.00,us:1.0,equity:1.0,1.0
VXUS,62.22,international:1.0,equity:1.0,1.1
VGT,550.00,us:1.0,equity:1.0,1.3
SCHD,82.00,us:1.0,equity:1.0,0.8
BND,72.00,us:1.0,bonds:1.0,0.2
VNQ,86.00,us:1.0,real_estate:1.0,0.7
CASH,1.00,us:1.0,cash:1.0,0.0

#accounts
name,tax_status,provider,owner
Alex_401k,traditional,fidelity,alex
Sam_401k,traditional,vanguard,sam
Alex_Roth_IRA,roth,schwab,alex
Sam_Roth_IRA,roth,schwab,sam
Joint_Brokerage,taxable,schwab,joint

#targets
symbol,percent
VTI,35
VXUS,25
VGT,10
SCHD,10
BND,10
VNQ,5
CASH,5
`,
  },
  {
    id: 'single-20s',
    label: 'Single, 20s',
    description: '~$75k across 3 accounts, aggressive all-equity growth',
    csv: `#holdings
account,symbol,shares
My_401k,VTI,120
My_401k,VXUS,150
Roth_IRA,QQQ,30
Roth_IRA,VGT,12
Brokerage,VTI,25
Brokerage,QQQ,10
Brokerage,CASH,3500

#symbols
name,price,countries,assets,beta
VTI,250.00,us:1.0,equity:1.0,1.0
VXUS,62.22,international:1.0,equity:1.0,1.1
QQQ,480.00,us:1.0,equity:1.0,1.2
VGT,550.00,us:1.0,equity:1.0,1.3
CASH,1.00,us:1.0,cash:1.0,0.0

#accounts
name,tax_status,provider,owner
My_401k,traditional,fidelity,mike
Roth_IRA,roth,schwab,mike
Brokerage,taxable,robinhood,mike

#targets
symbol,percent
VTI,40
VXUS,20
QQQ,25
VGT,15
`,
  },
  {
    id: 'retiree-60s',
    label: 'Retiree, 60s',
    description: '~$1M across 4 accounts, conservative income-focused 40/60 stocks/bonds',
    csv: `#holdings
account,symbol,shares
Trad_IRA,BND,2000
Trad_IRA,BNDX,1500
Trad_IRA,VTIP,1000
Trad_IRA,VTI,400
Trad_IRA,SCHD,500
Roth_IRA,VTI,300
Roth_IRA,VXUS,500
Roth_IRA,SCHD,400
Roth_IRA,VNQ,300
Brokerage,SCHD,1200
Brokerage,BND,1500
Brokerage,VTI,200
Brokerage,CASH,50000
Savings,CASH,120000

#symbols
name,price,countries,assets,beta
BND,72.00,us:1.0,bonds:1.0,0.2
BNDX,48.00,international:1.0,bonds:1.0,0.2
VTIP,49.00,us:1.0,bonds:1.0,0.1
SCHD,82.00,us:1.0,equity:1.0,0.8
VTI,250.00,us:1.0,equity:1.0,1.0
VXUS,62.22,international:1.0,equity:1.0,1.1
VNQ,86.00,us:1.0,real_estate:1.0,0.7
CASH,1.00,us:1.0,cash:1.0,0.0

#accounts
name,tax_status,provider,owner
Trad_IRA,traditional,vanguard,pat
Roth_IRA,roth,fidelity,pat
Brokerage,taxable,schwab,pat
Savings,taxable,treasury_direct,pat

#targets
symbol,percent
BND,25
BNDX,10
VTIP,5
SCHD,20
VTI,20
VXUS,10
VNQ,5
CASH,5
`,
  },
]
