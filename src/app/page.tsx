import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, BarChart3, Trophy, Activity } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-foreground">
            Rowing Tracker
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your SmartRow data into beautiful analytics. Track your progress, 
            discover patterns, and achieve your personal best.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/upload" className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Your Data
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
              <Link href="/upload">
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold text-foreground">
            Everything You Need to Track Your Progress
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built specifically for rowers who use SmartRow equipment
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="text-center">
            <CardHeader>
              <Upload className="h-12 w-12 mx-auto text-primary mb-4" />
              <CardTitle>Easy Import</CardTitle>
              <CardDescription>
                Drag and drop your SmartRow CSV files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Simply export from SmartRow and upload to get instant insights
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <BarChart3 className="h-12 w-12 mx-auto text-primary mb-4" />
              <CardTitle>Beautiful Analytics</CardTitle>
              <CardDescription>
                Visualize your performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track distance, pace, power, and stroke rate trends
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Trophy className="h-12 w-12 mx-auto text-primary mb-4" />
              <CardTitle>Personal Records</CardTitle>
              <CardDescription>
                Track your best times across all distances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor your progress and celebrate achievements
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Activity className="h-12 w-12 mx-auto text-primary mb-4" />
              <CardTitle>Session Details</CardTitle>
              <CardDescription>
                Deep dive into every workout
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Analyze power, splits, stroke rate, and more
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold text-foreground">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in three simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center space-y-4">
            <div className="bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center text-xl font-semibold mx-auto">
              1
            </div>
            <h3 className="text-xl font-semibold">Export from SmartRow</h3>
            <p className="text-muted-foreground">
              Open the SmartRow app, go to Settings, and export your data as CSV
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center text-xl font-semibold mx-auto">
              2
            </div>
            <h3 className="text-xl font-semibold">Upload Your Data</h3>
            <p className="text-muted-foreground">
              Drag and drop your CSV file or click to browse and select it
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center text-xl font-semibold mx-auto">
              3
            </div>
            <h3 className="text-xl font-semibold">View Your Analytics</h3>
            <p className="text-muted-foreground">
              Instantly see your dashboard with charts, stats, and personal records
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="bg-primary text-primary-foreground rounded-2xl p-12 text-center max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Track Your Rowing Progress?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Upload your first SmartRow CSV file and start visualizing your performance today.
          </p>
          <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
            <Link href="/upload" className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Your Data Now
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
